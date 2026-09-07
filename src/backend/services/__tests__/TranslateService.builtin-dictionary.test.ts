import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// 服务模块会经 simple-logger 依赖 electron（读取 userData 路径），
// 与 AiSdkUpgradeIntegration.test.ts 相同的 mock 约定，避免 require 真实 electron 可执行文件。
vi.mock('electron', () => ({
    app: {
        isPackaged: false,
        getPath: () => '/tmp/dashplayer-builtin-dict-test-userdata',
        getVersion: () => '6.1.0',
    },
    ipcMain: undefined,
    ipcRenderer: undefined,
}));

import AiProviderService from '@/backend/services/AiProviderService';
import ClientProviderService from '@/backend/services/ClientProviderService';
import { TranslateServiceImpl } from '@/backend/services/TranslateService';
import SettingService from '@/backend/services/SettingService';
import { YouDaoDictionaryClient } from '@/backend/services/gateways/translate/YouDaoDictionaryClient';
import WordTranslatesRepository from '@/backend/services/repositories/WordTranslatesRepository';
import RendererGateway from '@/backend/services/gateways/renderer/RendererGateway';
import { BuiltinDictionaryStoreImpl } from '@/backend/infrastructure/translate/BuiltinDictionaryStoreImpl';
import { createBuiltinDictionaryFixture } from '@/test/builtinDictionaryFixture';

describe('单词查询的预置词典优先链路', () => {
    let closeFixture: (() => void) | null = null;

    beforeEach(() => {
        vi.clearAllMocks();
    });

    afterEach(() => {
        closeFixture?.();
        closeFixture = null;
    });

    /**
     * 用真实的预置词典夹具装配 TranslateServiceImpl，其余依赖以边界桩注入。
     *
     * @param options getCurrentDictionaryProvider 的返回值与预置词表。
     */
    const buildService = (options: {
        dictionaryProvider: Promise<'openai' | 'youdao' | null>;
        words: Parameters<typeof createBuiltinDictionaryFixture>[0];
    }) => {
        const fixture = createBuiltinDictionaryFixture(options.words);
        closeFixture = fixture.close;

        const settingService = {
            getCurrentDictionaryProvider: vi.fn().mockResolvedValue(options.dictionaryProvider),
        } as unknown as SettingService;
        const youDaoProvider = {
            getClient: vi.fn().mockReturnValue(null),
        } as unknown as ClientProviderService<YouDaoDictionaryClient>;
        const rendererGateway = {
            call: vi.fn().mockResolvedValue(undefined),
            fireAndForget: vi.fn(),
        } as unknown as RendererGateway;
        const aiProviderService = {
            getModel: vi.fn().mockReturnValue(null),
        } as unknown as AiProviderService;
        const wordTranslatesRepository = {
            findOne: vi.fn().mockResolvedValue(null),
            upsert: vi.fn().mockResolvedValue(undefined),
        } as unknown as WordTranslatesRepository;
        const builtinDictionaryStore = new BuiltinDictionaryStoreImpl(fixture.dbPath);

        const service = new TranslateServiceImpl(
            youDaoProvider,
            rendererGateway,
            aiProviderService,
            settingService,
            wordTranslatesRepository,
            builtinDictionaryStore,
        );
        return { service, youDaoProvider, aiProviderService, wordTranslatesRepository };
    };

    it('未配置任何词典服务时，命中预置词典仍能返回释义', async () => {
        const { service } = buildService({
            dictionaryProvider: Promise.resolve(null),
            words: [{ word: 'cancel', phonetic: "'kænsәl", translation: 'n. 取消', collins: 3 }],
        });

        const result = await service.transWord('cancel');
        if (!result || !('definitions' in result)) {
            throw new Error('预置词典命中时应返回简化单词卡');
        }
        expect(result).toMatchObject({ word: 'cancel', collins: 3 });
        expect(result.definitions).toEqual([{ partOfSpeech: 'n.', meaning: '取消', examples: [] }]);
    });

    it('未配置词典服务且预置词典未命中时返回 null', async () => {
        const { service } = buildService({
            dictionaryProvider: Promise.resolve(null),
            words: [],
        });

        expect(await service.transWord('unknownword')).toBeNull();
    });

    it('强制刷新绕过预置词典：未配置词典服务时返回 null', async () => {
        const { service } = buildService({
            dictionaryProvider: Promise.resolve(null),
            words: [{ word: 'cancel', phonetic: '', translation: 'n. 取消' }],
        });

        expect(await service.transWord('cancel', true)).toBeNull();
    });

    it('已配置词典引擎时预置词典仍然优先，且不触发在线查询', async () => {
        const { service, youDaoProvider, aiProviderService, wordTranslatesRepository } = buildService({
            dictionaryProvider: Promise.resolve('openai'),
            words: [{ word: 'cancel', phonetic: '', translation: 'n. 取消', bnc: 3183 }],
        });

        const result = await service.transWord('cancel');

        expect(result).toMatchObject({ word: 'cancel', bnc: 3183 });
        // 预置命中即返回，在线链路不应被触发，也不应写入查询缓存
        expect(youDaoProvider.getClient).not.toHaveBeenCalled();
        expect(aiProviderService.getModel).not.toHaveBeenCalled();
        expect(wordTranslatesRepository.upsert).not.toHaveBeenCalled();
    });
});
