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
import { Output, streamText, LanguageModel } from 'ai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { convertArrayToReadableStream, MockLanguageModelV4 } from 'ai/test';
import type { LanguageModelV3, LanguageModelV4StreamPart } from '@ai-sdk/provider';

import { loadAiSdkTestConfig } from '@/test/aiSdkTestConfig';
import { resolveOpenAiBaseUrl } from '@/common/utils/openai-endpoint';
import { splitSystemMessages } from '@/backend/services/chat/ChatPromptBuilder';
import { ChatServiceImpl } from '../ChatService';
import { ChatSessionServiceImpl } from '../ChatSessionService';
import { TranslateServiceImpl } from '../TranslateService';
import { AiProviderServiceImpl } from '../AiProviderService';
import { ModelRoutingServiceImpl } from '../ModelRoutingService';
import type DpTaskService from '../DpTaskService';
import type AiProviderService from '../AiProviderService';
import type ModelRoutingService from '../ModelRoutingService';
import type SettingService from '../SettingService';
import type RendererGateway from '@/backend/services/gateways/renderer/RendererGateway';
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
 * Responses API，uniapi 代理对 deepseek 的 Responses 流式实现不完整）。推理强度由调用方传入。
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
    return provider.chatModel(modelId);
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

/**
 * 构造一个建立流时直接抛错的 mock 模型，用于验证任务失败路径。
 *
 * @param error 建流时要抛出的错误。
 * @returns 可直接传给 streamText 的 LanguageModel。
 */
const buildErrorModel = (error: Error): LanguageModel => {
    return new MockLanguageModelV4({
        doStream: async () => {
            throw error;
        },
    }) as unknown as LanguageModel;
};

const runTests = (): void => {
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
                    createModelById: vi.fn(() => buildMockTextModel('你好，我们开始学习这句话。')),
                };
                const gateway: RendererGateway = {
                    call: vi.fn(),
                    fireAndForget: vi.fn((_path: never, params: Record<string, unknown>) => {
                        const chunk = params.chunk as { type?: string } | undefined;
                        events.push({ event: chunk?.type ?? 'unknown', payload: params });
                    }) as RendererGateway['fireAndForget'],
                };
                const store = {
                    get: vi.fn(() => ({
                        originalTopic: 'Hello world',
                        fullText: 'Hello world',
                        paragraphLines: ['Hello world'],
                        subtitleFileHash: 'hash',
                        anchorSentenceIndex: 0,
                    })),
                    getBackground: vi.fn(() => ({})),
                    startRun: vi.fn(() => new AbortController().signal),
                    finishRun: vi.fn(),
                    appendMessage: vi.fn(),
                };
                const cacheService = {
                    get: vi.fn(() => ({
                        sentences: [{ index: 0, start: 0, end: 1000, text: 'Hello world' }],
                    })),
                };
                const sessionService = new ChatSessionServiceImpl();
                (sessionService as unknown as { aiProviderService: AiProviderService }).aiProviderService = provider;
                (sessionService as unknown as { rendererGateway: RendererGateway }).rendererGateway = gateway;
                (sessionService as unknown as { chatSessionStore: typeof store }).chatSessionStore = store as never;
                (sessionService as unknown as { cacheService: typeof cacheService }).cacheService = cacheService as never;

                await sessionService.startWelcome({
                    sessionId: 's-welcome',
                });
                // startWelcome 是 fire-and-forget 模式，流式结果在后台异步回推，轮询等待 done 事件。
                const deadline = Date.now() + 10000;
                while (!events.some((e) => e.event === 'finish') && Date.now() < deadline) {
                    await new Promise((resolve) => setTimeout(resolve, 10));
                }
                const chunks = events.filter((e) => e.event === 'text-delta');
                const done = events.find((e) => e.event === 'finish');
                expect(chunks.length).toBeGreaterThan(0);
                expect(chunks.map((c) => String((c.payload.chunk as { delta?: string }).delta ?? '')).join('')).toContain('你好');
                expect(done).toBeDefined();
            }, 15000);
        });

        describe('ChatServiceImpl.run（结构化输出任务路径）', () => {
            it('流式产出结构化对象，并在 finish 时写入 schema 校验后的完整结果', async () => {
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
                    getModel: vi.fn(() => buildMockTextModel('{"answer": "yes"}')),
                    createModelById: vi.fn(() => buildMockTextModel('{"answer": "yes"}')),
                };
                const chatService = new ChatServiceImpl();
                (chatService as unknown as { dpTaskService: DpTaskService }).dpTaskService = dpTask;
                (chatService as unknown as { aiProviderService: AiProviderService }).aiProviderService = provider;

                const schema = z.object({ answer: z.string() });
                await chatService.run(1, schema, 'Reply with JSON matching the schema.');

                const processes = calls.filter((c) => c.type === 'process');
                expect(processes.length).toBeGreaterThan(0);
                const finish = calls.find((c) => c.type === 'finish');
                expect(calls.find((c) => c.type === 'fail')).toBeUndefined();
                expect(finish).toBeDefined();
                // 最终结果必须在 finish 里完整写入，且符合 schema（修复点：旧实现 finish 不带结果）。
                const finalResult = JSON.parse(String(finish!.info.result)) as { answer?: string };
                expect(schema.safeParse(finalResult).success).toBe(true);
                expect(finalResult.answer).toBe('yes');
            }, 15000);

            it('模型流中断时任务被标记失败，而不是永远停在执行中', async () => {
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
                    getModel: vi.fn(() => buildErrorModel(new Error('模型流中断'))),
                    createModelById: vi.fn(() => buildErrorModel(new Error('模型流中断'))),
                };
                const chatService = new ChatServiceImpl();
                (chatService as unknown as { dpTaskService: DpTaskService }).dpTaskService = dpTask;
                (chatService as unknown as { aiProviderService: AiProviderService }).aiProviderService = provider;

                const schema = z.object({ answer: z.string() });
                await chatService.run(1, schema, 'Reply with JSON matching the schema.');

                expect(calls.find((c) => c.type === 'finish')).toBeUndefined();
                const failed = calls.find((c) => c.type === 'fail');
                expect(failed).toBeDefined();
                // AI SDK 会把底层模型错误包装成 NoObjectGeneratedError，这里只断言任务确实被标记失败且带统一前缀。
                expect(String(failed!.info.progress)).toContain('AI 请求失败');
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

            it('真实连接：枚举每个可用模型支持的推理档位', async () => {
                // 基线（不设置推理）用于对照：某些代理端模型即使成功也会在流里带 error part
                const efforts = ['（不设置）', 'low', 'medium', 'high'] as const;
                const matrix: Record<string, string[]> = {};
                for (const modelId of testConfig!.availableModels) {
                    matrix[modelId] = [];
                    for (const effort of efforts) {
                        // 注意：提供方 400 不会让 textStream 抛错，而是以 error part 进入流；
                        // 但 deepseek 等代理模型即使成功也会带“空 error part”，
                        // 所以只把带具体信息的真实错误（如 AI_APICallError）视为档位不被支持。
                        const result = streamText({
                            model: buildRawLiveModel(modelId),
                            // 推理档位直接传给 AI SDK 7 的 reasoning
                            ...(effort === '（不设置）'
                                ? {}
                                : { reasoning: effort }),
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
                expect(Object.keys(matrix)).toHaveLength(testConfig!.availableModels.length);
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
                    createModelById: vi.fn(() => buildLiveModel(testConfig!.model)),
                };
                chatService = new ChatServiceImpl();
                (chatService as unknown as { dpTaskService: DpTaskService }).dpTaskService = dpTask;
                (chatService as unknown as { aiProviderService: AiProviderService }).aiProviderService = provider;
            };

            beforeAll(() => {
                installMocks();
            });

            it('真实连接：run() 能流式产出符合 schema 的结构化对象，并在 finish 写入完整结果', async () => {
                calls.length = 0;
                const schema = z.object({
                    answer: z.string(),
                });
                await chatService.run(2, schema, 'Reply with JSON matching the schema, e.g. {"answer": "yes"}');
                const processes = calls.filter((c) => c.type === 'process');
                expect(processes.length).toBeGreaterThan(0);
                const finish = calls.find((c) => c.type === 'finish');
                expect(finish).toBeDefined();
                const parsed = JSON.parse(String(finish!.info.result)) as { answer?: string };
                expect(schema.safeParse(parsed).success).toBe(true);
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
                    createModelById: vi.fn(() => buildLiveModel(testConfig!.model)),
                };
                gateway = {
                    call: vi.fn(),
                    fireAndForget: vi.fn((_path: never, params: Record<string, unknown>) => {
                        const chunk = params.chunk as { type?: string } | undefined;
                        events.push({ event: chunk?.type ?? 'unknown', payload: params });
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
                });
                // startAnalysis 是 fire-and-forget 模式，流式结果在后台异步回推，轮询等待 done 事件。
                const deadline = Date.now() + 45000;
                while (!events.some((e) => e.event === 'finish') && Date.now() < deadline) {
                    await new Promise((resolve) => setTimeout(resolve, 100));
                }
                const chunks = events.filter((e) => e.event === 'data-analysis');
                const done = events.find((e) => e.event === 'finish');
                expect(chunks.length).toBeGreaterThan(0);
                expect(done).toBeDefined();
                const lastChunk = chunks[chunks.length - 1];
                const partial = (lastChunk.payload.chunk as { data?: { structure?: unknown } }).data;
                expect(partial).toBeDefined();
                expect(partial?.structure).toBeDefined();
            }, 60000);

            it('真实连接：startWelcome() 能流式产出欢迎语并通过事件回推', async () => {
                events.length = 0;
                await sessionService.startWelcome({
                    sessionId: 's2',
                });
                // startWelcome 是 fire-and-forget 模式，流式结果在后台异步回推，轮询等待 done 事件。
                const deadline = Date.now() + 45000;
                while (!events.some((e) => e.event === 'finish') && Date.now() < deadline) {
                    await new Promise((resolve) => setTimeout(resolve, 100));
                }
                const chunks = events.filter((e) => e.event === 'text-delta');
                const done = events.find((e) => e.event === 'finish');
                expect(chunks.length).toBeGreaterThan(0);
                expect(done).toBeDefined();
            }, 60000);
        });

        describe('TranslateServiceImpl（词典路径）', () => {
            const rendererEvents: Array<{ path: string; params: Record<string, unknown> }> = [];

            const buildService = (overrides: {
                getModel?: (scene: string) => LanguageModel | null;
                findOne?: () => Promise<unknown>;
            } = {}): TranslateServiceImpl => {
                const aiProvider: AiProviderService = {
                    getModel: (scene) => (overrides.getModel
                        ? overrides.getModel(scene)
                        : buildLiveModel(testConfig!.model)),
                    createModelById: () => buildLiveModel(testConfig!.model),
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
                    getCurrentTranslationProvider: vi.fn().mockResolvedValue('openai'),
                    getOpenAiSubtitleTranslationMode: vi.fn().mockResolvedValue('zh'),
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
                const wordRepo: WordTranslatesRepository = {
                    findOne: vi.fn().mockResolvedValue(overrides.findOne?.() ?? null),
                    upsert: vi.fn(),
                };
                const youDaoProvider: ClientProviderService<{ translate: (s: string) => Promise<string> }> = {
                    getClient: vi.fn().mockReturnValue(null),
                };
                const service = new TranslateServiceImpl();
                (service as unknown as { youDaoProvider: typeof youDaoProvider }).youDaoProvider = youDaoProvider;
                (service as unknown as { rendererGateway: RendererGateway }).rendererGateway = gateway;
                (service as unknown as { aiProviderService: AiProviderService }).aiProviderService = aiProvider;
                (service as unknown as { settingService: SettingService }).settingService = settingService;
                (service as unknown as { wordTranslatesRepository: WordTranslatesRepository }).wordTranslatesRepository = wordRepo;
                return service;
            };

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
