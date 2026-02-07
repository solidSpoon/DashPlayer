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

    it('keeps migrateProviderSettings as no-op for compatibility', async () => {
        await service.migrateProviderSettings();

        expect(mutableService.settingsStore.set).not.toHaveBeenCalled();
    });

    it('normalizes invalid provider values to none when querying', async () => {
        store.set('providers.subtitleTranslation', 'invalid');
        store.set('providers.dictionary', 'invalid');
        store.set('providers.transcription', 'invalid');

        const result = await service.queryEngineSelection();

        expect(result.providers.subtitleTranslationEngine).toBe('none');
        expect(result.providers.dictionaryEngine).toBe('none');
        expect(result.providers.transcriptionEngine).toBe('none');
        expect(result.openai.featureModels.sentenceLearning).toBe('gpt-5.2');
    });

    it('keeps feature models inside available models list', async () => {
        store.set('models.openai.available', 'gpt-5.2,gpt-4.1-mini');

        await service.updateEngineSelection({
            openai: {
                enableSentenceLearning: true,
                subtitleTranslationMode: 'zh',
                subtitleCustomStyle: 'style',
                featureModels: {
                    sentenceLearning: 'gpt-4.1-mini',
                    subtitleTranslation: 'not-exist',
                    dictionary: 'gpt-5.2',
                },
            },
            providers: {
                subtitleTranslationEngine: 'openai',
                dictionaryEngine: 'openai',
                transcriptionEngine: 'openai',
            },
        });

        expect(mutableService.settingsStore.get('models.openai.sentenceLearning')).toBe('gpt-4.1-mini');
        expect(mutableService.settingsStore.get('models.openai.subtitleTranslation')).toBe('gpt-5.2');
        expect(mutableService.settingsStore.get('models.openai.dictionary')).toBe('gpt-5.2');
    });

    it('returns null provider when engine is none', async () => {
        store.set('providers.subtitleTranslation', 'none');
        store.set('providers.dictionary', 'none');
        store.set('providers.transcription', 'none');

        await expect(service.getCurrentTranslationProvider()).resolves.toBeNull();
        await expect(service.getCurrentDictionaryProvider()).resolves.toBeNull();
        await expect(service.getCurrentTranscriptionProvider()).resolves.toBeNull();
    });

    it('rejects enabling whisper transcription when model missing', async () => {
        vi.spyOn(fs, 'existsSync').mockReturnValue(false);

        await expect(service.updateEngineSelection({
            openai: {
                enableSentenceLearning: true,
                subtitleTranslationMode: 'zh',
                subtitleCustomStyle: 'style',
                featureModels: {
                    sentenceLearning: 'gpt-5.2',
                    subtitleTranslation: 'gpt-5.2',
                    dictionary: 'gpt-5.2',
                },
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
