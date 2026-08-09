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
const storeState = vi.hoisted(() => ({ values: new Map<string, string>() }));
vi.mock('@/backend/infrastructure/settings/store', () => ({
    storeGet: (key: string) => storeState.values.get(key) ?? '',
    storeSet: (key: string, value: string) => {
        storeState.values.set(key, value);
        return true;
    },
    subscribeSettingChange: () => () => undefined,
}));

import { z } from 'zod';
import { ModelMessage, Output, streamText, LanguageModel } from 'ai';
import { createOpenAI } from '@ai-sdk/openai';

import { loadAiSdkTestConfig } from '@/test/aiSdkTestConfig';
import ChatServiceImpl from '../impl/ChatServiceImpl';
import ChatSessionServiceImpl from '../impl/ChatSessionServiceImpl';
import TranslateServiceImpl from '../impl/TranslateServiceImpl';
import AiProviderServiceImpl from '../impl/clients/AiProviderServiceImpl';
import ModelRoutingServiceImpl from '../impl/clients/ModelRoutingServiceImpl';
import type DpTaskService from '../DpTaskService';
import type AiProviderService from '../AiProviderService';
import type ModelRoutingService from '../ModelRoutingService';
import type SettingService from '../SettingService';
import type CacheService from '../CacheService';
import type RendererGateway from '@/backend/application/ports/gateways/renderer/RendererGateway';
import type SentenceTranslatesRepository from '@/backend/application/ports/repositories/SentenceTranslatesRepository';
import type WordTranslatesRepository from '@/backend/application/ports/repositories/WordTranslatesRepository';
import type ClientProviderService from '@/backend/application/services/ClientProviderService';

// 真实连接测试默认不跑（会发起计费请求）：需显式设置 DP_RUN_LIVE_AI_TESTS=true，
// 且开发环境配置文件（config.dev.json）里已配置 Key 时才执行。
const testConfig = loadAiSdkTestConfig();
const liveTestsEnabled = process.env.DP_RUN_LIVE_AI_TESTS === 'true';
const describeLive = liveTestsEnabled && testConfig ? describe : describe.skip;

/**
 * 构造一个直连测试用的真实 OpenAI 模型（走 @ai-sdk/openai v4 的 createOpenAI）。
 *
 * @param modelId 要使用的模型 id。
 * @returns 可直接传给 streamText 的 LanguageModel。
 */
const buildLiveModel = (modelId: string): LanguageModel => {
    const openai = createOpenAI({
        baseURL: `${testConfig!.endpoint}/v1`,
        apiKey: testConfig!.key,
    });
    return openai(modelId);
};

const runTests = (): void => {
    describeLive('AI SDK 升级验证（ai v7 + @ai-sdk/openai v4）', () => {
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
                    getEngineSelectionDetail: vi.fn(),
                    saveEngineSelection: vi.fn(),
                    migrateProviderSettings: vi.fn(),
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
                const cacheService: CacheService = {
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
                (service as unknown as { cacheService: CacheService }).cacheService = cacheService;
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
