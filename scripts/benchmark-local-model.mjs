#!/usr/bin/env node
/**
 * 本地模型批量翻译成功率基准。
 *
 * 复刻 LocalSubtitleBatchTranslator / LocalAiRuntime 的提示词模板、
 * 采样参数与校验规则，在独立 llama-server 进程上对比两种模式的成功率：
 * - batch：整批 5 句一次翻译（含组前后句上下文）；
 * - single：逐句翻译，每次只翻一句，输入当前句与前后句。
 *
 * 用法：
 *   node scripts/benchmark-local-model.mjs --trials 8 \
 *     --srt "/path/to/video.srt" --srt-start 105
 *
 * 可选参数：
 *   --model   GGUF 模型路径；默认探测 ~/Documents/DashPlayer/local_ai 下的 0.8B
 *   --runtime llama-server 路径；默认取仓库 lib/ 下按平台架构解析的运行时
 *   --trials  批次试次（每组 5 句，两种模式各跑一遍），默认 8
 *   --srt     真实字幕语料（SRT）；缺省使用内置通用语料
 *   --srt-start 从字幕第几行开始取语料，默认 0
 *
 * 注意：提示词模板与采样参数需与
 * src/backend/infrastructure/translate/subtitleBatchPrompt.ts、
 * src/backend/infrastructure/ai/LocalAiRuntime.ts 保持一致，改动时同步。
 */
import { spawn } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import net from 'node:net';
import os from 'node:os';
import path from 'node:path';

/** 与 LocalAiRuntime 一致的采样与上限参数。 */
const SAMPLING = { temperature: 0.6, top_p: 0.95, top_k: 20, maxTokens: 2048 };
/** 与 createSubtitleBatchResultSchema 等价的结构化输出 JSON Schema。 */
const RESULT_JSON_SCHEMA = {
    type: 'object',
    properties: {
        items: {
            type: 'array',
            items: {
                type: 'object',
                properties: { key: { type: 'string' }, translation: { type: 'string' } },
                required: ['key', 'translation'],
                additionalProperties: false,
            },
        },
    },
    required: ['items'],
    additionalProperties: false,
};
/** 与 getSubtitleDefaultStyle('zh') 一致的默认风格。 */
const DEFAULT_STYLE = '将原句自然、口语化地翻译成简体中文，语序可适度调整以保证流畅易读，保留原句语气与情感。';

/** 内置通用语料：--srt 缺省时使用，混入部分技术词汇模拟真实字幕。 */
const BUILTIN_LINES = [
    'The weather turned colder as the sun went down.',
    'She packed the last box and looked around the empty apartment.',
    'You know, pack around hot dog compressor.',
    'This one has opportunities for checking oil.',
    'There is oil in there, it is clean. Frankly, I am shocked.',
    'This has a changeable or at least cleanable air filter,',
    'so that you are not sucking dirt into the pump and scoring your piston.',
    'And this has a tank that is undoubtedly holding more water than it should.',
    'This is was a great compressor.',
    'I stacked 194 houses in one tract in one year, just off this compressor.',
    'But I killed it prematurely by not keeping the air filter changed.',
    'The nut vibrated off, the housing vibrated off.',
    'And it finally just stopped compressing air.',
    'Your compressor is going to compress the air just as far as it can',
    'until it runs up against the limit switch so it does not blow itself up.',
    'You have two gauges ordinarily.',
    'He promised to call as soon as the meeting ended.',
    'Nobody expected the storm to arrive so early in the season.',
    'The train arrives at platform nine in ten minutes.',
    'Make sure you torque the bolts in a crisscross pattern.',
    'The firmware update bricked half of the units on the first night.',
    'We will drain that in a little bit.',
    'Just a couple more things before we wrap up.',
    'Look at that guy, he has been living in there for weeks.',
    'The pressure that the pump itself is making is only half of the story.',
];

/**
 * 解析命令行参数。
 * @returns 归一化后的基准配置。
 */
function parseArgs() {
    const args = process.argv.slice(2);
    const read = (name) => {
        const i = args.indexOf(`--${name}`);
        return i >= 0 ? args[i + 1] : undefined;
    };
    const platformDir = `${process.platform}-${process.arch}`;
    const exeName = process.platform === 'win32' ? 'llama-server.exe' : 'llama-server';
    const defaultRuntime = path.resolve(process.cwd(), 'lib', 'llama', 'b10819', platformDir, exeName);
    const defaultModel = path.join(
        os.homedir(), 'Documents', 'DashPlayer', 'local_ai',
        'qwen3.5-0.8b-q4_k_m', 'Qwen3.5-0.8B-Q4_K_M.gguf',
    );
    const model = read('model') ?? defaultModel;
    const runtime = read('runtime') ?? defaultRuntime;
    if (!existsSync(model)) {
        console.error(`❌ 找不到模型文件：${model}\n   用 --model 指定 GGUF 路径`);
        process.exit(1);
    }
    if (!existsSync(runtime)) {
        console.error(`❌ 找不到 llama-server：${runtime}\n   先执行 yarn run download，或用 --runtime 指定`);
        process.exit(1);
    }
    const srtPath = read('srt');
    let lines = BUILTIN_LINES;
    if (srtPath) {
        lines = parseSrt(srtPath);
        const start = Number(read('srt-start') ?? 0);
        lines = lines.slice(start, start + 30);
        if (lines.length < 5) {
            console.error(`❌ 字幕可用行不足 5 行（取到 ${lines.length} 行），检查 --srt-start`);
            process.exit(1);
        }
    }
    return {
        model,
        runtime,
        trials: Number(read('trials') ?? 8),
        lines,
        sourceLabel: srtPath ? `${path.basename(srtPath)}@${read('srt-start') ?? 0}` : 'builtin',
        // 生产环境的字幕键形如 ${fileHash}:${index}（见 sentence.ts），
        // 小模型照抄随机哈希的难度远高于纯数字，这里默认用真实键形。
        keyHash: read('key-hash') ?? '0fb74af8bc32',
    };
}

/**
 * 解析 SRT 字幕为纯文本行（去掉序号与时间轴，多行合并为一句）。
 * @param srtPath SRT 文件路径。
 * @returns 按顺序排列的字幕原文行。
 */
function parseSrt(srtPath) {
    const blocks = readFileSync(srtPath, 'utf-8').split(/\n\s*\n/);
    const lines = [];
    for (const block of blocks) {
        const parts = block.split('\n');
        if (parts.length >= 3) {
            lines.push(parts.slice(2).join(' ').replace(/<[^>]+>/g, '').trim());
        }
    }
    return lines.filter((line) => line.length > 0);
}

/** 申请一个空闲回环端口，避免与运行中的应用冲突。 */
function reservePort() {
    return new Promise((resolve, reject) => {
        const server = net.createServer();
        server.once('error', reject);
        server.listen(0, '127.0.0.1', () => {
            const address = server.address();
            if (!address || typeof address === 'string') { server.close(); reject(new Error('无法申请端口')); return; }
            server.close((error) => (error ? reject(error) : resolve(address.port)));
        });
    });
}

/**
 * 启动 llama-server 并等待健康检查通过。
 * @param config 基准配置。
 * @returns 子进程与端口；调用方负责 kill。
 */
async function startRuntime(config) {
    const port = await reservePort();
    const args = [
        '--model', config.model,
        '--host', '127.0.0.1', '--port', String(port),
        '--ctx-size', '8192', '--parallel', '1', '--jinja', '--no-webui',
        '--chat-template-kwargs', '{"enable_thinking":false}', '--reasoning-budget', '0',
        // 与正式环境一致：Vulkan 包在无 GPU 机器上会自动落到 CPU。
        '--n-gpu-layers', '99',
    ];
    const child = spawn(config.runtime, args, { stdio: ['ignore', 'ignore', 'pipe'] });
    const stderrTail = [];
    child.stderr.on('data', (chunk) => {
        stderrTail.push(...chunk.toString().split('\n').map((line) => line.trim()).filter(Boolean));
        if (stderrTail.length > 15) stderrTail.splice(0, stderrTail.length - 15);
    });
    const deadline = Date.now() + 120_000;
    for (;;) {
        if (child.exitCode !== null) {
            throw new Error(`llama-server 提前退出（code=${child.exitCode}）：\n${stderrTail.join('\n')}`);
        }
        if (Date.now() > deadline) {
            child.kill('SIGKILL');
            throw new Error('llama-server 健康检查超时');
        }
        try {
            const response = await fetch(`http://127.0.0.1:${port}/health`, { signal: AbortSignal.timeout(1000) });
            if ((await response.json())?.status === 'ok') break;
        } catch { /* 未就绪，继续轮询 */ }
        await new Promise((resolve) => setTimeout(resolve, 250));
    }
    return { child, port, stderrTail };
}

/**
 * 组装批量翻译提示词（与 buildSubtitleBatchPrompt 保持一致）。
 * @param targets 待翻译条目 {key,text}。
 * @param contextBefore 组前句数组。
 * @param contextAfter 组后句数组。
 * @returns 可直接发送的 prompt。
 */
function buildPrompt(targets, contextBefore, contextAfter) {
    const template = `You are a professional subtitle translation assistant.

Follow these style guidelines closely:
{{style}}

You will receive target subtitle lines and optional surrounding context in JSON format.
Context lines (contextBefore and contextAfter) are READ-ONLY references to help understand tone, intent, and terminology.

Rules:
1. Return exactly one translation for every item in targets.
2. Copy every target key exactly; never change, omit, duplicate, or invent keys.
3. NEVER translate, include, or return contextBefore or contextAfter items.
4. Do not merge or split target lines.
5. Every translation must be a non-empty string. If a target should remain unchanged, return its original text.
6. Respond with valid JSON only in the following shape:
{"items":[{"key":"target_key","translation":"translated_text"}]}

Subtitle request:
{{request}}`;
    return template
        .replace(/{{\s*style\s*}}/gi, DEFAULT_STYLE)
        .replace(/{{\s*request\s*}}/gi, JSON.stringify({ targets, contextBefore, contextAfter }, null, 2));
}

/**
 * 发起一次 chat 请求并返回响应体。
 * @param port llama-server 端口。
 * @param prompt 提示词。
 * @returns 原始响应 JSON。
 */
async function chat(port, prompt) {
    const startedAt = Date.now();
    const response = await fetch(`http://127.0.0.1:${port}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: AbortSignal.timeout(200_000),
        body: JSON.stringify({
            model: 'bench',
            messages: [{ role: 'user', content: prompt }],
            stream: false,
            temperature: SAMPLING.temperature,
            top_p: SAMPLING.top_p,
            top_k: SAMPLING.top_k,
            max_tokens: SAMPLING.maxTokens,
            response_format: { type: 'json_object', schema: RESULT_JSON_SCHEMA },
            chat_template_kwargs: { enable_thinking: false },
        }),
    });
    const body = await response.json();
    return { body, durationMs: Date.now() - startedAt };
}

/**
 * 按正式环境同等规则校验一次响应。
 * @param response chat 响应体。
 * @param targets 本次请求的目标条目。
 * @returns { ok, reason, completionTokens }；reason 为失败时的短标签。
 */
function validate(response, targets) {
    const choice = response?.choices?.[0];
    if (!choice) return { ok: false, reason: 'no_choice' };
    if (choice.finish_reason !== 'stop') return { ok: false, reason: `finish_reason=${choice.finish_reason}` };
    let parsed;
    try {
        parsed = JSON.parse(choice.message.content);
    } catch {
        return { ok: false, reason: 'json_parse' };
    }
    const items = parsed?.items;
    if (!Array.isArray(items)) return { ok: false, reason: 'no_items' };
    if (items.length !== targets.length) {
        return { ok: false, reason: `count expected=${targets.length} actual=${items.length}` };
    }
    const keys = new Set(targets.map((t) => t.key));
    for (const item of items) {
        if (!keys.has(item.key)) return { ok: false, reason: `unknown_key: ${String(item.key).slice(0, 40)}` };
        if (typeof item.translation !== 'string' || item.translation.trim().length === 0) {
            return { ok: false, reason: 'empty_translation' };
        }
    }
    if (new Set(items.map((item) => item.key)).size !== items.length) return { ok: false, reason: 'duplicate_key' };
    return { ok: true, reason: 'ok', completionTokens: response.usage?.completion_tokens ?? null };
}

/**
 * 执行一次翻译调用并返回校验结果与耗时。
 * @param port 端口。
 * @param targets 目标条目。
 * @param contextBefore 组前句。
 * @param contextAfter 组后句。
 */
async function runCall(port, targets, contextBefore, contextAfter) {
    const prompt = buildPrompt(targets, contextBefore, contextAfter);
    const { body, durationMs } = await chat(port, prompt);
    const verdict = validate(body, targets);
    return {
        ...verdict,
        durationMs,
        completionTokens: verdict.completionTokens ?? body?.usage?.completion_tokens ?? null,
    };
}

/** 进度输出前缀。 */
const label = (mode, i, total) => `[${mode} ${String(i + 1).padStart(String(total).length, ' ')}/${total}]`;

/**
 * 主流程：起运行时 → 两种模式各跑 trials 组 → 输出汇总。
 */
async function main() {
    const config = parseArgs();
    console.log(`== 本地模型翻译成功率基准 ==`);
    console.log(`模型: ${config.model}`);
    console.log(`语料: ${config.sourceLabel}（${config.lines.length} 行）  试次: ${config.trials}`);
    console.log(`采样: temp=${SAMPLING.temperature} top_p=${SAMPLING.top_p} top_k=${SAMPLING.top_k} max_tokens=${SAMPLING.maxTokens}\n`);

    const { child, port, stderrTail } = await startRuntime(config);
    const newStats = () => ({ ok: 0, fail: {}, durations: [], tokens: [], callOk: 0, callTotal: 0 });
    const stats = {
        batchReal: newStats(),
        batchNumeric: newStats(),
        singleNumeric: newStats(),
    };
    try {
        const record = (mode, result, stat, trial) => {
            stat.durations.push(result.durationMs);
            if (result.completionTokens) stat.tokens.push(result.completionTokens);
            if (result.ok) { stat.ok += 1; }
            else { stat.fail[result.reason] = (stat.fail[result.reason] ?? 0) + 1; }
            console.log(`${label(mode, trial, config.trials)} ${result.ok ? '✅' : `❌ ${result.reason}`} ${(result.durationMs / 1000).toFixed(1)}s${result.completionTokens ? ` (${result.completionTokens} tok)` : ''}`);
        };

        for (let trial = 0; trial < config.trials; trial += 1) {
            const offset = (trial * 5) % config.lines.length;
            const group = [];
            for (let i = 0; i < 5; i += 1) {
                group.push(config.lines[(offset + i) % config.lines.length]);
            }
            const before = config.lines[(offset - 1 + config.lines.length) % config.lines.length];
            const after = config.lines[(offset + 5) % config.lines.length];
            const targets = group.map((text, i) => ({ key: `${config.keyHash}:${offset + i}`, text }));
            const contextBefore = [{ key: `${config.keyHash}:${offset - 1}`, text: before }];
            const contextAfter = [{ key: `${config.keyHash}:${offset + 5}`, text: after }];

            // 模式一：整批 + 真实哈希键（旧生产行为，对照组）。
            record('整批·哈希键', await runCall(port, targets, contextBefore, contextAfter), stats.batchReal, trial);

            // 模式二：整批 + 数字键（新行为，模型只抄短键）。
            const numericTargets = targets.map((target, i) => ({ key: String(i + 1), text: target.text }));
            const numericBefore = [{ key: '0', text: before }];
            const numericAfter = [{ key: '6', text: after }];
            record('整批·数字键', await runCall(port, numericTargets, numericBefore, numericAfter), stats.batchNumeric, trial);

            // 模式三：逐句 + 真实键（新行为，一次只翻一句）。
            let trialOk = true;
            for (let i = 0; i < targets.length; i += 1) {
                const singleTargets = [targets[i]];
                const singleBefore = i > 0 ? [targets[i - 1]] : contextBefore;
                const singleAfter = i < targets.length - 1 ? [targets[i + 1]] : contextAfter;
                const single = await runCall(port, singleTargets, singleBefore, singleAfter);
                stats.singleNumeric.callTotal += 1;
                stats.singleNumeric.durations.push(single.durationMs);
                if (single.completionTokens) stats.singleNumeric.tokens.push(single.completionTokens);
                if (single.ok) { stats.singleNumeric.callOk += 1; }
                else {
                    trialOk = false;
                    stats.singleNumeric.fail[single.reason] = (stats.singleNumeric.fail[single.reason] ?? 0) + 1;
                    console.log(`  [逐句 ${trial + 1}/${config.trials}]   ❌ 第 ${i + 1} 句 ${single.reason} ${(single.durationMs / 1000).toFixed(1)}s`);
                }
            }
            if (trialOk) { stats.singleNumeric.ok += 1; }
            console.log(`  [逐句 ${trial + 1}/${config.trials}] ${trialOk ? '✅ 5/5' : '❌ 有句子失败'}`);
        }
    } finally {
        child.kill();
    }

    const summarize = (name, stat, trialBased) => {
        const total = trialBased ? config.trials : stat.callTotal;
        const okCount = trialBased ? stat.ok : stat.callOk;
        const durations = stat.durations;
        const avg = (list) => (list.length ? (list.reduce((a, b) => a + b, 0) / list.length) : 0);
        const avgTokPerSec = avg(durations.map((d, i) => (stat.tokens[i] ?? 0) / (d / 1000)).filter((v) => v > 0));
        console.log(`\n[${name}] ${trialBased ? '按批次' : '按单句调用'}`);
        console.log(`  成功率: ${okCount}/${total} (${total ? Math.round(okCount / total * 100) : 0}%)`);
        console.log(`  平均耗时: ${(avg(durations) / 1000).toFixed(1)}s  平均吞吐: ${avgTokPerSec ? avgTokPerSec.toFixed(1) : '—'} tok/s`);
        const fails = Object.entries(stat.fail);
        console.log(fails.length
            ? `  失败分布: ${fails.map(([reason, count]) => `${reason} ×${count}`).join(', ')}`
            : '  失败分布: 无');
    };
    summarize('整批·真实哈希键（旧生产）', stats.batchReal, true);
    summarize('整批·数字键（新）', stats.batchNumeric, true);
    summarize('逐句·真实键（新，按单句计）', stats.singleNumeric, false);
    if (stderrTail.length > 0) {
        console.log(`\nllama-server stderr 末尾:\n  ${stderrTail.slice(-5).join('\n  ')}`);
    }
}

main().catch((error) => {
    console.error('❌ 基准执行失败：', error);
    process.exit(1);
});
