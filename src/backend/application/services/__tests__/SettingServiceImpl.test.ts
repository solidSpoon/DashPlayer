import { beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import SettingServiceImpl from '../impl/SettingServiceImpl';
import { SettingKey, SettingKeyObj } from '@/common/types/store_schema';

vi.mock('inversify', () => ({
    injectable: () => (target: unknown) => target,
    inject: () => (target: unknown, _propertyKey: string) => target,
}));

vi.mock('@/backend/utils/LocationUtil', () => ({
    default: {
        staticGetStoragePath: vi.fn(() => '/tmp'),
    },
}));

vi.mock('@/backend/infrastructure/logger', () => ({
    getMainLogger: () => ({
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        debug: vi.fn(),
    }),
}));

describe('SettingServiceImpl', () => {
    let service: SettingServiceImpl;
    let store: Map<SettingKey, string>;
    let mutableService: {
        rendererEvents: { storeUpdate: ReturnType<typeof vi.fn> };
        systemConfigService: { getValue: ReturnType<typeof vi.fn> };
        settingsStore: {
            get: (key: SettingKey) => string;
            set: (key: SettingKey, value: string) => boolean;
        };
    };

    beforeEach(() => {
        service = new SettingServiceImpl();
        store = new Map<SettingKey, string>();
        mutableService = service as unknown as typeof mutableService;

        mutableService.rendererEvents = { storeUpdate: vi.fn() };
        mutableService.systemConfigService = {
            getValue: vi.fn().mockResolvedValue('legacy style'),
        };
        mutableService.settingsStore = {
            get: vi.fn((key: SettingKey) => store.get(key) ?? SettingKeyObj[key]),
            set: vi.fn((key: SettingKey, value: string) => {
                const oldValue = store.get(key) ?? SettingKeyObj[key];
                if (oldValue === value) {
                    return false;
                }
                store.set(key, value);
                return true;
            }),
        };

        vi.spyOn(fs, 'existsSync').mockReturnValue(true);
    });

    it('migrates legacy keys into provider keys once', async () => {
        store.set('subtitleTranslation.engine', 'tencent');
        store.set('dictionary.engine', 'youdao');
        store.set('transcription.engine', 'whisper');

        await service.migrateProviderSettings();

        expect(mutableService.settingsStore.get('providers.subtitleTranslation')).toBe('tencent');
        expect(mutableService.settingsStore.get('providers.dictionary')).toBe('youdao');
        expect(mutableService.settingsStore.get('providers.transcription')).toBe('whisper');
        expect(mutableService.settingsStore.get('settings.providers.migrated')).toBe('true');
    });

    it('normalizes invalid provider values to none when querying', async () => {
        store.set('settings.providers.migrated', 'true');
        store.set('providers.subtitleTranslation', 'invalid');
        store.set('providers.dictionary', 'invalid');
        store.set('providers.transcription', 'invalid');

        const result = await service.queryEngineSelection();

        expect(result.providers.subtitleTranslationEngine).toBe('none');
        expect(result.providers.dictionaryEngine).toBe('none');
        expect(result.providers.transcriptionEngine).toBe('none');
        expect(result.openai.featureModels.sentenceLearning).toBe('gpt-4o-mini');
    });

    it('keeps feature models inside available models list', async () => {
        store.set('settings.providers.migrated', 'true');
        store.set('models.openai.available', 'gpt-4o-mini,gpt-4.1-mini');

        await service.updateEngineSelection({
            openai: {
                enableSentenceLearning: true,
                subtitleTranslationMode: 'zh',
                subtitleCustomStyle: 'style',
                featureModels: {
                    sentenceLearning: 'gpt-4.1-mini',
                    subtitleTranslation: 'not-exist',
                    dictionary: 'gpt-4o-mini',
                    transcription: 'bad-model',
                },
            },
            providers: {
                subtitleTranslationEngine: 'openai',
                dictionaryEngine: 'openai',
                transcriptionEngine: 'openai',
            },
        });

        expect(mutableService.settingsStore.get('models.openai.sentenceLearning')).toBe('gpt-4.1-mini');
        expect(mutableService.settingsStore.get('models.openai.subtitleTranslation')).toBe('gpt-4o-mini');
        expect(mutableService.settingsStore.get('models.openai.dictionary')).toBe('gpt-4o-mini');
        expect(mutableService.settingsStore.get('models.openai.transcription')).toBe('gpt-4o-mini');
    });

    it('returns null provider when engine is none', async () => {
        store.set('settings.providers.migrated', 'true');
        store.set('providers.subtitleTranslation', 'none');
        store.set('providers.dictionary', 'none');
        store.set('providers.transcription', 'none');

        await expect(service.getCurrentTranslationProvider()).resolves.toBeNull();
        await expect(service.getCurrentDictionaryProvider()).resolves.toBeNull();
        await expect(service.getCurrentTranscriptionProvider()).resolves.toBeNull();
    });

    it('rejects enabling whisper transcription when model missing', async () => {
        store.set('settings.providers.migrated', 'true');
        vi.spyOn(fs, 'existsSync').mockReturnValue(false);

        await expect(service.updateEngineSelection({
            openai: {
                enableSentenceLearning: true,
                subtitleTranslationMode: 'zh',
                subtitleCustomStyle: 'style',
            },
            providers: {
                subtitleTranslationEngine: 'none',
                dictionaryEngine: 'none',
                transcriptionEngine: 'whisper',
            },
        })).rejects.toThrow('Whisper 模型未下载');
    });

    it('contains i18n language setting default', () => {
        expect(SettingKeyObj['i18n.language']).toBe('system');
    });
});
