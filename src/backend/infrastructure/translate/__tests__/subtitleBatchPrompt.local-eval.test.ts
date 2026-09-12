import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { spawn, ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import axios, { isAxiosError } from 'axios';
import {
    buildLocalSubtitleFillGrammar,
    buildLocalSubtitleFillPrompt,
    LOCAL_TRANSLATION_TEMPERATURE,
    parseLocalSubtitleFill,
} from '@/backend/infrastructure/translate/subtitleBatchPrompt';
import { OPENAI_SUBTITLE_DEFAULT_STYLES } from '@/common/constants/openaiSubtitlePrompts';

/**
 * 本地增强链路真实推理评测（门控）：提示词/解码策略调整前后对比翻译质量。
 *
 * 默认跳过。开启方式（模型路径必传，运行时可省略——仓库执行过
 * `yarn run download` 时按开发模式路径自动定位）：
 *
 * ```bash
 * LOCAL_EVAL_MODEL=/path/to/Qwen3.5-2B-Q4_K_M.gguf \
 * [LOCAL_EVAL_RUNTIME=/path/to/llama-server] \
 * [LOCAL_EVAL_TEMP=0.3] \
 * yarn test:run src/backend/infrastructure/translate/__tests__/subtitleBatchPrompt.local-eval.test.ts
 * ```
 *
 * 断言只覆盖结构契约（行数、有中文、非照抄、无元话/标签模仿），
 * 逐行对照结果打印到控制台由人评审译质。温度可用 LOCAL_EVAL_TEMP
 * 覆盖以便 A/B 对比；缺省用生产值。
 *
 * 历史对比结论（2026-02，Qwen3.5-2B + Vulkan GPU）：紧凑行式方案在
 * 长行悬挂收尾的批次稳定合译后回抄英文凑行（本文件「车间气泵批次」
 * 即真实失败案例），逐行解码与源文锚定填槽均 12/12 全过；填槽为
 * 单请求，落地为生产策略。调整输出策略时保留用例作为回归基准。
 */

const runtimePath = process.env.LOCAL_EVAL_RUNTIME
    ?? path.resolve('lib', 'llama', 'b10819', `${process.platform}-${process.arch}`,
        process.platform === 'win32' ? 'llama-server.exe' : 'llama-server');
const modelPath = process.env.LOCAL_EVAL_MODEL ?? '';
const evalTemperature = process.env.LOCAL_EVAL_TEMP
    ? Number(process.env.LOCAL_EVAL_TEMP)
    : LOCAL_TRANSLATION_TEMPERATURE;
const evalReady = modelPath.length > 0 && fs.existsSync(runtimePath);

/** 构造与生产网关一致的 zh 模式语义输入；风格用生产默认值。 */
const buildEvalInput = (lines: string[], contextBefore?: string) => ({
    targets: lines.map((text, index) => ({ key: `eval-${index}`, text })),
    contextBefore: contextBefore ? [{ key: 'eval-ctx-before', text: contextBefore }] : [],
    contextAfter: [],
    mode: 'zh' as const,
    style: OPENAI_SUBTITLE_DEFAULT_STYLES.zh,
    signal: new AbortController().signal,
    modelId: 'eval',
});

/**
 * 评测批次用例：覆盖历史失败的三类形态——跨行续句被合译（截图批次）、
 * 连续多组续句、独立短句与数字术语。contextBefore 用于验证只读上下文
 * 不泄漏进输出。
 */
const EVAL_CASES: { name: string; contextBefore?: string; lines: string[] }[] = [
    {
        name: '车间气泵批次（历史失败批次，含两处跨行续句）',
        contextBefore: 'Hey everyone, welcome back to the channel.',
        lines: [
            "We're going to talk about fittings and hose sizes and all that sort of thing in",
            'a few minutes.',
            "But first, here's the situation with the air in my shop the way it",
            'exists now.',
            'So you saw the air come in from the 125 CFM,',
        ],
    },
    {
        name: '连续多组跨行续句批次',
        lines: [
            'I wanted to tell you that the meeting is',
            'on Tuesday at noon.',
            "She said she'd bring the documents as soon as",
            'the courier arrives at the office.',
            "Until then we'll just have to wait.",
        ],
    },
    {
        name: '独立短句批次',
        lines: [
            'The weather turned colder as the sun went down.',
            'She packed the last box and looked around the empty apartment.',
            'The train arrives at platform nine in ten minutes.',
            'He promised to call as soon as the meeting ended.',
            'Nobody expected the storm to arrive so early in the season.',
        ],
    },
    {
        name: '数字与工程术语批次',
        lines: [
            'So you saw the air come in from the 125 CFM, two inch line.',
            'and it runs along half inch galvanized pipe.',
            'The compressor kicks in at 90 PSI.',
            "That's about six bars of pressure.",
            "Don't exceed that or the fittings will fail.",
        ],
    },
];

/** 元话/标签模仿的常见形态：命中即说明模型输出被填充行污染。 */
const META_LINE_PATTERNS: RegExp[] = [
    /^（注[/：:]/,
    /^第[一二两三四五六七八九十百\d]+句/,
    /->|=>|→/,
    /^译文[:：]/,
    /^翻译[:：]/,
    /^原文[:：]/,
    /^Source[:：]/i,
    /^Simplified Chinese[:：]/i,
    /^English[:：]/i,
];

/** 与实现侧照抄检测同口径的归一化：剥离全部非字母数字后转小写。 */
const normalizeForEchoCheck = (text: string): string =>
    text.replace(/[^\p{L}\p{N}]+/gu, '').toLowerCase();

/** 评测侧判断译文行是否为可用中文：必须是中文且非照抄原文。 */
const isUsableZhLine = (source: string, translation: string): boolean =>
    /[\u4e00-\u9fff]/.test(translation)
    && normalizeForEchoCheck(translation) !== normalizeForEchoCheck(source);

describe.skipIf(!evalReady)('本地增强字幕翻译真实推理评测（源文锚定填槽，生产策略）', () => {
    let child: ChildProcess | null = null;
    let endpoint = '';
    const stderrTail: string[] = [];

    /** 申请回环动态端口，与生产 LocalAiRuntime 同一策略。 */
    const reservePort = () => new Promise<number>((resolve, reject) => {
        const server = net.createServer();
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => {
            const address = server.address();
            if (!address || typeof address === 'string') { server.close(); reject(new Error('无法申请评测端口')); return; }
            server.close((error) => error ? reject(error) : resolve(address.port));
        });
    });

    beforeAll(async () => {
        const port = await reservePort();
        endpoint = `http://127.0.0.1:${port}`;
        // GPU 判定与生产 gpuEnabled() 同口径：darwin-arm64 走 Metal；
        // 其余平台看运行包是否带 Vulkan 后端库。
        let gpuLayers = '0';
        if (process.platform === 'darwin' && process.arch === 'arm64') {
            gpuLayers = '99';
        } else if (['libggml-vulkan.so', 'ggml-vulkan.dll']
            .some((name) => fs.existsSync(path.join(path.dirname(runtimePath), name)))) {
            gpuLayers = '99';
        }
        child = spawn(runtimePath, [
            '--model', modelPath, '--host', '127.0.0.1', '--port', String(port),
            '--ctx-size', '8192', '--parallel', '1', '--jinja', '--no-webui',
            '--chat-template-kwargs', '{"enable_thinking":false}', '--reasoning-budget', '0',
            '--n-gpu-layers', gpuLayers,
        ], { windowsHide: true, stdio: ['ignore', 'ignore', 'pipe'] });
        child.stderr?.on('data', (chunk: Buffer) => {
            stderrTail.push(...chunk.toString().split('\n').map((line) => line.slice(-500)));
            if (stderrTail.length > 20) stderrTail.splice(0, stderrTail.length - 20);
        });
        child.once('close', (code) => { if (endpoint) stderrTail.push(`runtime exited: ${code}`); });
        const deadline = Date.now() + 120_000;
        for (;;) {
            if (Date.now() > deadline) {
                throw new Error(`llama-server 健康检查超时，stderr 末尾：\n${stderrTail.join('\n')}`);
            }
            try {
                const response = await axios.get(`${endpoint}/health`, { proxy: false, adapter: 'http', timeout: 1000 });
                if (response.data?.status === 'ok') return;
            } catch (error) {
                if (isAxiosError(error) && (error.code === 'ECONNREFUSED' || error.code === 'ECONNABORTED' || error.response?.status === 503)) {
                    await new Promise((resolve) => setTimeout(resolve, 250));
                    continue;
                }
                throw error;
            }
        }
    }, 180_000);

    afterAll(async () => {
        const exiting = child;
        child = null;
        if (!exiting) return;
        exiting.kill();
        const timer = setTimeout(() => exiting.kill('SIGKILL'), 3000);
        await new Promise<void>((resolve) => exiting.once('close', () => resolve()));
        clearTimeout(timer);
    });

    /**
     * 走一次与生产 buildChatBody 同形状的 chat 请求（温度可被 LOCAL_EVAL_TEMP 覆盖）。
     * 评测不设 LLAMA_API_KEY，回环地址无需鉴权。vitest 运行在 jsdom 环境，
     * axios 默认会选 XHR 适配器并受 CORS 限制，必须显式钉在 node http 上。
     */
    const generate = async (prompt: string, grammar: string) => {
        const response = await axios.post(`${endpoint}/v1/chat/completions`, {
            model: 'eval',
            messages: [{ role: 'user', content: prompt }],
            stream: false,
            temperature: evalTemperature,
            top_p: 0.95,
            top_k: 20,
            max_tokens: 2048,
            grammar,
            chat_template_kwargs: { enable_thinking: false },
        }, { proxy: false, adapter: 'http', timeout: 180_000 });
        return response.data as {
            choices: { finish_reason: string; message: { content: string } }[];
            usage?: { prompt_tokens: number; completion_tokens: number };
        };
    };

    for (const evalCase of EVAL_CASES) {
        it(`批次「${evalCase.name}」：行数对齐、无元话、无照抄`, async () => {
            const input = buildEvalInput(evalCase.lines, evalCase.contextBefore);
            const sources = input.targets.map((target) => target.text);
            const prompt = buildLocalSubtitleFillPrompt(input, input.style, { forbidEcho: true });
            const grammar = buildLocalSubtitleFillGrammar(sources);
            const startedAt = Date.now();
            const result = await generate(prompt, grammar);
            expect(result.choices[0].finish_reason).toBe('stop');
            if (result.usage) {
                console.log(`[usage] prompt=${result.usage.prompt_tokens} completion=${result.usage.completion_tokens} temperature=${evalTemperature}`);
            }
            const lines = parseLocalSubtitleFill(result.choices[0].message.content, sources);
            console.log(`[fill] ${evalCase.name} 耗时 ${Date.now() - startedAt}ms`);
            console.log('---------- 逐行对照 ----------');
            for (const [index, source] of evalCase.lines.entries()) {
                console.log(`${index + 1}. ${source}\n   → ${lines[index]}`);
            }
            console.log('------------------------------');

            for (const [index, source] of evalCase.lines.entries()) {
                const translation = lines[index];
                expect(isUsableZhLine(source, translation),
                    `第 ${index + 1} 行译文不是可用中文：${translation}`).toBe(true);
                for (const pattern of META_LINE_PATTERNS) {
                    expect(translation, `第 ${index + 1} 行命中元话/标签模仿 ${pattern}：${translation}`).not.toMatch(pattern);
                }
            }
        }, 300_000);
    }
});
