import { describe, it, expect, vi, beforeAll } from 'vitest';

// 服务模块会经 simple-logger 依赖 electron（读取 userData 路径），
// vitest 下必须 mock，否则 require('electron') 只返回可执行文件路径字符串。
// userData 指向临时目录，保证日志等写入不落在真实应用目录。
vi.mock('electron', () => ({
    app: {
        isPackaged: false,
        getPath: () => '/tmp/dashplayer-ai-sdk-test-userdata',
        getVersion: () => '6.1.0',
    },
    ipcMain: undefined,
    ipcRenderer: undefined,
    shell: { openPath: vi.fn() },
}));

// electron-store 是外部化 CJS 依赖，vitest 里 vi.mock('electron') 拦不到它内部的 require，
// 会导致它回落到 ~/Library/Preferences 等真实目录写入配置（曾把开发 Key 写出去）。
// 因此把应用 store 模块整体 mock 成内存实现，测试数据只存在于内存，绝不落盘。
// 与生产 storeGet 行为一致：未写入的键回落到 SettingKeyObj 里的默认值（如 apiKeys.openAi.autoAppendV1 默认 'true'）。
import { SettingKeyObj } from '@/common/types/store_schema';
import type { SettingKey } from '@/common/types/store_schema';
const storeState = vi.hoisted(() => ({ values: new Map<string, string>() }));
vi.mock('@/backend/infrastructure/settings/store', () => ({
    storeGet: (key: string) => storeState.values.get(key) ?? SettingKeyObj[key as SettingKey] ?? '',
    storeSet: (key: string, value: string) => {
        storeState.values.set(key, value);
        return true;
    },
    subscribeSettingChange: () => () => undefined,
}));

import { z } from 'zod';
import { ModelMessage, Output, streamText, LanguageModel, wrapLanguageModel } from 'ai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { convertArrayToReadableStream, MockLanguageModelV4 } from 'ai/test';
import type { LanguageModelV3, LanguageModelV4StreamPart } from '@ai-sdk/provider';

import { loadAiSdkTestConfig } from '@/test/aiSdkTestConfig';
import { resolveOpenAiBaseUrl } from '@/common/utils/openai-endpoint';
import { splitSystemMessages } from '@/backend/services/chat/ChatPromptBuilder';
import { ChatServiceImpl } from '../ChatService';
import { ChatSessionServiceImpl } from '../ChatSessionService';
import { TranslateServiceImpl } from '../TranslateService';
import { AiProviderServiceImpl, isNoneReasoningModel } from '../AiProviderService';
import { ModelRoutingServiceImpl } from '../ModelRoutingService';
import type DpTaskService from '../DpTaskService';
import type AiProviderService from '../AiProviderService';
import type ModelRoutingService from '../ModelRoutingService';
import type SettingService from '../SettingService';
import type CacheService from '../CacheService';
import type RendererGateway from '@/backend/services/gateways/renderer/RendererGateway';
import type SentenceTranslatesRepository from '@/backend/services/repositories/SentenceTranslatesRepository';
import type WordTranslatesRepository from '@/backend/services/repositories/WordTranslatesRepository';
import type ClientProviderService from '@/backend/services/ClientProviderService';

// 真实连接测试默认不跑（会发起计费请求）：需显式设置 DP_RUN_LIVE_AI_TESTS=true，
// 且开发环境配置文件（config.dev.json）里已配置 Key 时才执行。
const testConfig = loadAiSdkTestConfig();
const liveTestsEnabled = process.env.DP_RUN_LIVE_AI_TESTS === 'true';
const describeLive = liveTestsEnabled && testConfig ? describe : describe.skip;

/**
 * 构造一个与生产 getModel 完全一致的直连测试模型：
 * @ai-sdk/openai-compatible 的 chat 模型（只走 /chat/completions，避开官方 provider 默认的
 * Responses API，uniapi 代理对 deepseek 的 Responses 流式实现不完整）+ 仅对已知支持 none 的
 * 模型族注入 reasoningEffort: 'none'（关闭推理，最快响应），其余模型不注入保持默认档位。
 *
 * @param modelId 要使用的模型 id。
 * @returns 可直接传给 streamText 的 LanguageModel。
 */
const buildLiveModel = (modelId: string): LanguageModel => {
    const provider = createOpenAICompatible({
        name: 'openai',
        baseURL: resolveOpenAiBaseUrl(testConfig!.endpoint, testConfig!.autoAppendV1),
        apiKey: testConfig!.key,
    });
    // 与生产 getModel 的门控一致：isNoneReasoningModel 为假时不注入（走模型默认档位）
    if (!isNoneReasoningModel(modelId)) {
        return provider.chatModel(modelId);
    }
    return wrapLanguageModel({
        model: provider.chatModel(modelId),
        middleware: {
            transformParams: async ({ params }) => ({
                ...params,
                providerOptions: {
                    ...params.providerOptions,
                    openai: { reasoningEffort: 'none' },
                },
            }),
        },
    });
};

/**
 * 构造一个不带推理注入的裸 chat 模型，仅用于枚举各模型支持的推理档位（档位由调用方显式传入）。
 *
 * @param modelId 要使用的模型 id。
 * @returns 可直接传给 streamText 的 LanguageModel。
 */
const buildRawLiveModel = (modelId: string): LanguageModelV3 => {
    const provider = createOpenAICompatible({
        name: 'openai',
        baseURL: resolveOpenAiBaseUrl(testConfig!.endpoint, testConfig!.autoAppendV1),
        apiKey: testConfig!.key,
    });
    return provider.chatModel(modelId);
};

/**
 * 构造一个返回固定文本流、不发真实请求的 mock 模型，供离线回归测试使用。
 *
 * @param text 模型固定返回的文本内容。
 * @returns 可直接传给 streamText 的 LanguageModel。
 */
const buildMockTextModel = (text: string): LanguageModel => {
    // 显式标注流部件类型，让 TS 能精确收窄到 LanguageModelV4StreamPart 联合
    const streamParts: LanguageModelV4StreamPart[] = [
        { type: 'text-start', id: 'mock-text' },
        { type: 'text-delta', id: 'mock-text', delta: text },
        { type: 'text-end', id: 'mock-text' },
        {
            type: 'finish',
            finishReason: { unified: 'stop', raw: 'stop' },
            usage: {
                inputTokens: { total: 10, noCache: 10, cacheRead: 0, cacheWrite: 0 },
                outputTokens: { total: 5, text: 5, reasoning: 0 },
            },
        },
    ];
    return new MockLanguageModelV4({
        doStream: async () => ({
            stream: convertArrayToReadableStream(streamParts),
        }),
    }) as unknown as LanguageModel;
};

const runTests = (): void => {
    // 离线回归：不发真实请求，守护 getModel 的推理门控（只对已知支持 none 的模型族注入）。
    describe('推理门控（isNoneReasoningModel）', () => {
        it.each([
            ['gpt-5.4-nano', true],
            ['gpt-5.1', true],
            ['gpt-5.2', true],
            ['gpt-5.6-sol', true],
            ['gpt-5', false],
            ['gpt-5-mini', false],
            ['gpt-5-chat-latest', false],
            ['gpt-5.2-pro', false],
            ['gpt-5.1-codex', false],
            ['o3', false],
            ['o4-mini', false],
            ['gpt-oss-120b', false],
            ['deepseek-v4-flash', true],
            ['deepseek-v5', true],
            ['deepseek-v10', true],
            ['deepseek-chat', false],
            ['deepseek-v3', false],
            ['glm-5', true],
            ['glm-5.2', true],
            ['glm-5.5', true],
            ['glm-4.6', false],
            ['glm-4.7', false],
            ['glm-z1', false],
            ['doubao-seed-1-6', true],
            ['doubao-1-5-thinking-pro-m', true],
            ['doubao-seed-1-6-251015', false],
            ['doubao-seed-1-6-flash', false],
            ['mistral-small-2603', true],
            ['mistral-small-2501', false],
            ['grok-4.3', true],
            ['grok-4.3-non-reasoning', false],
            ['grok-4', false],
        ])('模型 %s 的 none 注入判断应为 %s', (modelId, expected) => {
            expect(isNoneReasoningModel(modelId)).toBe(expected);
        });
    });

    // 离线回归：不发真实请求，默认测试（yarn test）就能跑，守护整句学习面板的欢迎语句路径。
    describe('整句学习欢迎语句（AI SDK v7 离线回归）', () => {
        describe('splitSystemMessages（system 消息拆分）', () => {
            it('能把开头 system 消息拆出并保留剩余消息', () => {
                const { system, messages } = splitSystemMessages([
                    { role: 'system', content: '你是学习伙伴' },
                    { role: 'user', content: '用户问题' },
                    { role: 'assistant', content: '助手回答' },
                ]);
                expect(system).toBe('你是学习伙伴');
                expect(messages).toEqual([
                    { role: 'user', content: '用户问题' },
                    { role: 'assistant', content: '助手回答' },
                ]);
            });

            it('多个 system 消息按原顺序用空行拼接', () => {
                const { system, messages } = splitSystemMessages([
                    { role: 'system', content: '第一条' },
                    { role: 'user', content: '问题' },
                    { role: 'system', content: '第二条' },
                ]);
                expect(system).toBe('第一条\n\n第二条');
                expect(messages).toEqual([{ role: 'user', content: '问题' }]);
            });

            it('没有 system 消息时返回 undefined 且消息不变', () => {
                const { system, messages } = splitSystemMessages([
                    { role: 'user', content: '问题' },
                ]);
                expect(system).toBeUndefined();
                expect(messages).toEqual([{ role: 'user', content: '问题' }]);
            });
        });

        describe('ChatSessionServiceImpl.startWelcome（整句学习面板欢迎语路径）', () => {
            it('system+user 消息能流式产出欢迎语并通过事件回推，而不是空流直接 done', async () => {
                const events: Array<{ event: string; payload: Record<string, unknown> }> = [];
                const provider: AiProviderService = {
                    getModel: vi.fn(() => buildMockTextModel('你好，我们开始学习这句话。')),
                };
                const gateway: RendererGateway = {
                    call: vi.fn(),
                    fireAndForget: vi.fn((_path: never, params: Record<string, unknown>) => {
                        events.push({ event: String(params.event), payload: params });
                    }) as RendererGateway['fireAndForget'],
                };
                const sessionService = new ChatSessionServiceImpl();
                (sessionService as unknown as { aiProviderService: AiProviderService }).aiProviderService = provider;
                (sessionService as unknown as { rendererGateway: RendererGateway }).rendererGateway = gateway;

                await sessionService.startWelcome({
                    sessionId: 's-welcome',
                    originalTopic: 'The monkeys start off by expecting zero reward.',
                });
                // startWelcome 是 fire-and-forget 模式，流式结果在后台异步回推，轮询等待 done 事件。
                const deadline = Date.now() + 10000;
                while (!events.some((e) => e.event === 'done') && Date.now() < deadline) {
                    await new Promise((resolve) => setTimeout(resolve, 10));
                }
                const chunks = events.filter((e) => e.event === 'chunk');
                const done = events.find((e) => e.event === 'done');
                expect(chunks.length).toBeGreaterThan(0);
                expect(chunks.map((c) => String(c.payload.chunk)).join('')).toContain('你好');
                expect(done).toBeDefined();
            }, 15000);
        });

        describe('ChatServiceImpl.chat（句子学习对话路径）', () => {
            it('带 system 消息的对话能流式产出文本并完成任务', async () => {
                const calls: Array<{ type: string; id: number; info: Record<string, unknown> }> = [];
                const dpTask: DpTaskService = {
                    create: vi.fn().mockResolvedValue(1),
                    detail: vi.fn(),
                    details: vi.fn(),
                    update: vi.fn(),
                    process: vi.fn((id, info) => calls.push({ type: 'process', id, info: info as Record<string, unknown> })),
                    finish: vi.fn((id, info) => calls.push({ type: 'finish', id, info: info as Record<string, unknown> })),
                    fail: vi.fn((id, info) => calls.push({ type: 'fail', id, info: info as Record<string, unknown> })),
                    cancel: vi.fn(),
                    checkCancel: vi.fn(),
                    registerTask: vi.fn(),
                };
                const provider: AiProviderService = {
                    getModel: vi.fn(() => buildMockTextModel('这句话可以这样说')),
                };
                const chatService = new ChatServiceImpl();
                (chatService as unknown as { dpTaskService: DpTaskService }).dpTaskService = dpTask;
                (chatService as unknown as { aiProviderService: AiProviderService }).aiProviderService = provider;

                const messages: ModelMessage[] = [
                    { role: 'system', content: '你是用户的英语学习伙伴。' },
                    { role: 'user', content: '这句话怎么理解？' },
                ];
                await chatService.chat(1, messages);
                const finish = calls.find((c) => c.type === 'finish');
                expect(finish).toBeDefined();
                const result = JSON.parse(String(finish!.info.result ?? '{}')) as { str: string };
                expect(result.str).toContain('这句话可以这样说');
            }, 15000);
        });
    });

    describeLive('AI SDK 升级验证（ai v7 + @ai-sdk/openai-compatible）', () => {
        describe('推理强度（reasoning effort）档位与模型兼容性', () => {
            it('真实连接：生产 getModel 路径（按模型族注入 none 或保持默认）对每个可用模型都能流式产出文本', async () => {
                expect(testConfig!.availableModels.length).toBeGreaterThan(0);
                for (const modelId of testConfig!.availableModels) {
                    // buildLiveModel 与生产 getModel 一致：兼容 provider + 仅对已知支持 none 的模型族注入最快档位
                    const result = streamText({
                        model: buildLiveModel(modelId),
                        prompt: 'Reply with exactly: ok',
                    });
                    let text = '';
                    for await (const chunk of result.textStream) {
                        text += chunk;
                    }
                    expect(text.trim().length, `模型 ${modelId} 经生产 getModel 路径应能产出文本`).toBeGreaterThan(0);
                }
            }, 120000);

            it('真实连接：枚举每个可用模型支持的推理档位，并保证 none 通用', async () => {
                // 基线（不设置推理）用于对照：某些代理端模型即使成功也会在流里带 error part
                const efforts = ['（不设置）', 'minimal', 'low', 'none'] as const;
                const matrix: Record<string, string[]> = {};
                for (const modelId of testConfig!.availableModels) {
                    matrix[modelId] = [];
                    for (const effort of efforts) {
                        // 注意：提供方 400 不会让 textStream 抛错，而是以 error part 进入流；
                        // 但 deepseek 等代理模型即使成功也会带“空 error part”，
                        // 所以只把带具体信息的真实错误（如 AI_APICallError）视为档位不被支持。
                        const result = streamText({
                            model: buildRawLiveModel(modelId),
                            // 兼容 provider 不认顶层 reasoning 参数，档位必须走 providerOptions.<name>.reasoningEffort
                            ...(effort === '（不设置）'
                                ? {}
                                : { providerOptions: { openai: { reasoningEffort: effort } } }),
                            prompt: 'Reply with exactly: ok',
                            onError: () => {},
                        });
                        let rejected = false;
                        for await (const part of result.fullStream) {
                            if (part.type === 'error' && part.error && (part.error as Error).message) {
                                rejected = true;
                            }
                        }
                        if (!rejected) {
                            matrix[modelId].push(effort);
                        }
                    }
                }
                console.log('[推理档位兼容矩阵]', JSON.stringify(matrix));
                // 生产门控只对已知支持 none 的模型族注入（isNoneReasoningModel 为真），
                // 其余模型保持默认档位；因此只断言这些模型必须接受 none
                for (const modelId of testConfig!.availableModels) {
                    if (isNoneReasoningModel(modelId)) {
                        expect(matrix[modelId]).toContain('none');
                    }
                }
            }, 120000);
        });

        describe('streamText 文本流（聊天/欢迎语等通用路径）', () => {
            it('真实连接：messages 输入能流式产出文本并正常结束', async () => {
                const result = streamText({
                    model: buildLiveModel(testConfig!.model),
                    messages: [
                        { role: 'user', content: 'Reply with exactly: hello' },
                    ],
                });
                let collected = '';
                for await (const chunk of result.textStream) {
                    collected += chunk;
                }
                expect(collected.trim().length).toBeGreaterThan(0);
                expect(collected.toLowerCase()).toContain('hello');
            }, 60000);

            it('真实连接：prompt 输入能流式产出文本（旧版字幕纯文本翻译路径）', async () => {
                const result = streamText({
                    model: buildLiveModel(testConfig!.model),
                    prompt: 'Reply with exactly: ok',
                });
                let collected = '';
                for await (const chunk of result.textStream) {
                    collected += chunk;
                }
                expect(collected.trim().length).toBeGreaterThan(0);
            }, 60000);
        });

        describe('Output.object 结构化输出（分析/字幕/词典等路径）', () => {
            it('真实连接：结构化对象流能产出完整且 schema 合法的对象', async () => {
                const schema = z.object({
                    translation: z.string(),
                });
                const result = streamText({
                    model: buildLiveModel(testConfig!.model),
                    output: Output.object({ schema }),
                    prompt: 'Translate "hello world" to Simplified Chinese, respond with JSON matching the schema.',
                });
                const partials: Array<Partial<{ translation: string }>> = [];
                for await (const partial of result.partialOutputStream) {
                    partials.push(partial ?? {});
                }
                const finalObject = await result.output;
                expect(partials.length).toBeGreaterThan(0);
                expect(finalObject).toBeDefined();
                expect(schema.safeParse(finalObject).success).toBe(true);
            }, 60000);
        });

        describe('AiProviderServiceImpl（应用真实取模型路径）', () => {
            it('真实连接：开发配置里的 Key 经 electron-store 取模型后能完成一次文本流', async () => {
                // Key/endpoint/模型路由字段与开发环境配置文件（config.dev.json）一致，写进隔离的测试 store 后走应用真实取模型路径。
                const { storeSet } = await import('@/backend/infrastructure/settings/store');
                storeSet('apiKeys.openAi.key', testConfig!.key);
                storeSet('apiKeys.openAi.endpoint', testConfig!.endpoint);
                storeSet('apiKeys.openAi.autoAppendV1', testConfig!.autoAppendV1);
                if (testConfig!.availableModels.length > 0) {
                    storeSet('models.openai.available', testConfig!.availableModels.join('\n'));
                }
                if (testConfig!.sentenceLearningModel) {
                    storeSet('models.openai.sentenceLearning', testConfig!.sentenceLearningModel);
                }

                const routingService = new ModelRoutingServiceImpl();
                const providerService = new AiProviderServiceImpl();
                (providerService as unknown as { modelRoutingService: ModelRoutingService }).modelRoutingService = routingService;

                const model = providerService.getModel('sentenceLearning');
                expect(model).not.toBeNull();
                const result = streamText({
                    model: model!,
                    prompt: 'Reply with exactly: provider-ok',
                });
                let collected = '';
                for await (const chunk of result.textStream) {
                    collected += chunk;
                }
                expect(collected.trim().length).toBeGreaterThan(0);
            }, 60000);
        });

        describe('ChatServiceImpl（句子学习 chat / run 任务路径）', () => {
            let chatService: ChatServiceImpl;
            let dpTask: DpTaskService;
            let provider: AiProviderService;
            const calls: Array<{ type: string; id: number; info: Record<string, unknown> }> = [];

            const installMocks = (): void => {
                dpTask = {
                    create: vi.fn().mockResolvedValue(1),
                    detail: vi.fn(),
                    details: vi.fn(),
                    update: vi.fn(),
                    process: vi.fn((id, info) => calls.push({ type: 'process', id, info: info as Record<string, unknown> })),
                    finish: vi.fn((id, info) => calls.push({ type: 'finish', id, info: info as Record<string, unknown> })),
                    fail: vi.fn((id, info) => calls.push({ type: 'fail', id, info: info as Record<string, unknown> })),
                    cancel: vi.fn(),
                    checkCancel: vi.fn(),
                    registerTask: vi.fn(),
                };
                provider = {
                    getModel: vi.fn(() => buildLiveModel(testConfig!.model)),
                };
                chatService = new ChatServiceImpl();
                (chatService as unknown as { dpTaskService: DpTaskService }).dpTaskService = dpTask;
                (chatService as unknown as { aiProviderService: AiProviderService }).aiProviderService = provider;
            };

            beforeAll(() => {
                installMocks();
            });

            it('真实连接：chat() 能流式回传文本并完成任务', async () => {
                calls.length = 0;
                const messages: ModelMessage[] = [
                    { role: 'system', content: '你是用户的英语学习伙伴，帮他看剧学英语。' },
                    { role: 'user', content: 'Say exactly: hi there' },
                ];
                await chatService.chat(1, messages);
                const processes = calls.filter((c) => c.type === 'process');
                const finish = calls.find((c) => c.type === 'finish');
                expect(processes.length).toBeGreaterThan(0);
                expect(finish).toBeDefined();
                const lastProcess = processes[processes.length - 1];
                const result = JSON.parse(String(lastProcess.info.result ?? '{}')) as { str: string };
                expect(result.str.trim().length).toBeGreaterThan(0);
            }, 60000);

            it('真实连接：run() 能流式产出符合 schema 的结构化对象', async () => {
                calls.length = 0;
                const schema = z.object({
                    answer: z.string(),
                });
                await chatService.run(2, schema, 'Reply with JSON matching the schema, e.g. {"answer": "yes"}');
                const processes = calls.filter((c) => c.type === 'process');
                expect(processes.length).toBeGreaterThan(0);
                const lastProcess = processes[processes.length - 1];
                expect(lastProcess.info.result).toBeDefined();
                const parsed = JSON.parse(String(lastProcess.info.result)) as { answer?: string };
                expect(typeof parsed.answer).toBe('string');
            }, 60000);
        });

        describe('ChatSessionServiceImpl（播放页对话/句子分析路径）', () => {
            let sessionService: ChatSessionServiceImpl;
            let provider: AiProviderService;
            let gateway: RendererGateway;
            const events: Array<{ event: string; payload: Record<string, unknown> }> = [];

            beforeAll(() => {
                provider = {
                    getModel: vi.fn(() => buildLiveModel(testConfig!.model)),
                };
                gateway = {
                    call: vi.fn(),
                    fireAndForget: vi.fn((_path: never, params: Record<string, unknown>) => {
                        events.push({ event: String(params.event), payload: params });
                    }) as RendererGateway['fireAndForget'],
                };
                sessionService = new ChatSessionServiceImpl();
                (sessionService as unknown as { aiProviderService: AiProviderService }).aiProviderService = provider;
                (sessionService as unknown as { rendererGateway: RendererGateway }).rendererGateway = gateway;
            });

            it('真实连接：startAnalysis() 能产出结构化分析并通过事件回推', async () => {
                events.length = 0;
                await sessionService.startAnalysis({
                    sessionId: 's1',
                    text: 'The quick brown fox jumps over the lazy dog.',
                });
                // startAnalysis 是 fire-and-forget 模式，流式结果在后台异步回推，轮询等待 done 事件。
                const deadline = Date.now() + 45000;
                while (!events.some((e) => e.event === 'done') && Date.now() < deadline) {
                    await new Promise((resolve) => setTimeout(resolve, 100));
                }
                const chunks = events.filter((e) => e.event === 'chunk');
                const done = events.find((e) => e.event === 'done');
                expect(chunks.length).toBeGreaterThan(0);
                expect(done).toBeDefined();
                const lastChunk = chunks[chunks.length - 1];
                const partial = lastChunk.payload.partial as { structure?: unknown };
                expect(partial.structure).toBeDefined();
            }, 60000);

            it('真实连接：startWelcome() 能流式产出欢迎语并通过事件回推', async () => {
                events.length = 0;
                await sessionService.startWelcome({
                    sessionId: 's2',
                    originalTopic: 'The quick brown fox jumps over the lazy dog.',
                });
                // startWelcome 是 fire-and-forget 模式，流式结果在后台异步回推，轮询等待 done 事件。
                const deadline = Date.now() + 45000;
                while (!events.some((e) => e.event === 'done') && Date.now() < deadline) {
                    await new Promise((resolve) => setTimeout(resolve, 100));
                }
                const chunks = events.filter((e) => e.event === 'chunk');
                const done = events.find((e) => e.event === 'done');
                expect(chunks.length).toBeGreaterThan(0);
                expect(done).toBeDefined();
            }, 60000);
        });

        describe('TranslateServiceImpl（字幕翻译 / 词典路径）', () => {
            const rendererEvents: Array<{ path: string; params: Record<string, unknown> }> = [];

            const buildService = (overrides: {
                getModel?: (scene: string) => LanguageModel | null;
                getCurrentTranslationProvider?: () => Promise<'openai' | 'tencent' | null>;
                getOpenAiSubtitleTranslationMode?: () => Promise<'zh' | 'simple_en' | 'custom'>;
                findTranslatedBySentencesAndMode?: () => Promise<unknown[]>;
                findOne?: () => Promise<unknown>;
            } = {}): TranslateServiceImpl => {
                const aiProvider: AiProviderService = {
                    getModel: (scene) => (overrides.getModel
                        ? overrides.getModel(scene)
                        : buildLiveModel(testConfig!.model)),
                };
                const settingService: SettingService = {
                    getServiceCredentialsDetail: vi.fn(),
                    saveServiceCredentials: vi.fn(),
                    getRuntimeSettings: vi.fn(),
                    saveRuntimeSetting: vi.fn(),
                    getEngineSelectionDetail: vi.fn(),
                    saveEngineSelection: vi.fn(),
                    getShortcutSettingsDetail: vi.fn(),
                    saveShortcutSettings: vi.fn(),
                    getAppearanceSettingDetail: vi.fn(),
                    saveAppearanceSettings: vi.fn(),
                    getStorageSettingDetail: vi.fn(),
                    saveStorageSettings: vi.fn(),
                    getProxySettingDetail: vi.fn(),
                    saveProxySettings: vi.fn(),
                    getCurrentSentenceLearningProvider: vi.fn().mockResolvedValue('openai'),
                    getCurrentTranslationProvider: vi.fn().mockResolvedValue(overrides.getCurrentTranslationProvider?.() ?? Promise.resolve('openai')),
                    getOpenAiSubtitleTranslationMode: vi.fn().mockResolvedValue(overrides.getOpenAiSubtitleTranslationMode?.() ?? Promise.resolve<'zh' | 'simple_en' | 'custom'>('zh')),
                    getOpenAiSubtitleCustomStyle: vi.fn().mockResolvedValue(''),
                    getCurrentDictionaryProvider: vi.fn().mockResolvedValue('openai'),
                    testOpenAi: vi.fn(),
                    testTencent: vi.fn(),
                    testYoudao: vi.fn(),
                };
                const gateway: RendererGateway = {
                    call: vi.fn(async (_path: never, params: Record<string, unknown>) => {
                        rendererEvents.push({ path: _path as string, params });
                    }) as RendererGateway['call'],
                    fireAndForget: vi.fn(),
                };
                const cacheService: Pick<CacheService, 'get' | 'set' | 'delete' | 'clear'> = {
                    get: vi.fn(),
                    set: vi.fn(),
                    delete: vi.fn(),
                    clear: vi.fn(),
                };
                const wordRepo: WordTranslatesRepository = {
                    findOne: vi.fn().mockResolvedValue(overrides.findOne?.() ?? null),
                    upsert: vi.fn(),
                };
                const sentenceRepo: SentenceTranslatesRepository = {
                    findBySentencesAndMode: vi.fn().mockResolvedValue([]),
                    findTranslatedBySentencesAndMode: vi.fn().mockResolvedValue(overrides.findTranslatedBySentencesAndMode?.() ?? []),
                    upsert: vi.fn(),
                    upsertMany: vi.fn(),
                };
                const youDaoProvider: ClientProviderService<{ translate: (s: string) => Promise<string> }> = {
                    getClient: vi.fn().mockReturnValue(null),
                };
                const tencentProvider: ClientProviderService<{ batchTrans: (s: string[]) => Promise<Map<string, string>> }> = {
                    getClient: vi.fn().mockReturnValue(null),
                };
                const service = new TranslateServiceImpl();
                (service as unknown as { youDaoProvider: typeof youDaoProvider }).youDaoProvider = youDaoProvider;
                (service as unknown as { tencentProvider: typeof tencentProvider }).tencentProvider = tencentProvider;
                (service as unknown as { rendererGateway: RendererGateway }).rendererGateway = gateway;
                (service as unknown as { aiProviderService: AiProviderService }).aiProviderService = aiProvider;
                (service as unknown as {
                    cacheService: Pick<CacheService, 'get' | 'set' | 'delete' | 'clear'>;
                }).cacheService = cacheService;
                (service as unknown as { settingService: SettingService }).settingService = settingService;
                (service as unknown as { wordTranslatesRepository: WordTranslatesRepository }).wordTranslatesRepository = wordRepo;
                (service as unknown as { sentenceTranslatesRepository: SentenceTranslatesRepository }).sentenceTranslatesRepository = sentenceRepo;
                return service;
            };

            it('真实连接：transSentences() 通过结构化输出批量翻译并返回结果', async () => {
                const service = buildService();
                const result = await service.transSentences(['Hello world']);
                expect(result.size).toBeGreaterThan(0);
                const translation = Array.from(result.values())[0];
                expect(translation.trim().length).toBeGreaterThan(0);
            }, 60000);

            it('真实连接：transWord() 通过结构化输出返回词典结果', async () => {
                const service = buildService();
                const result = await service.transWord('serendipity', true);
                expect(result).not.toBeNull();
                if (result && 'definitions' in result) {
                    expect(result.word.toLowerCase()).toBe('serendipity');
                    expect(result.definitions.length).toBeGreaterThan(0);
                }
            }, 60000);
        });
    });
};

runTests();
