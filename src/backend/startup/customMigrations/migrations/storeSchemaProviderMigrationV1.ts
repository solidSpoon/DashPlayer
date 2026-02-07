import Store from 'electron-store';
import { eq } from 'drizzle-orm';

import db from '@/backend/infrastructure/db';
import { systemConfigs } from '@/backend/infrastructure/db/tables/sysConf';
import { getEnvironmentConfigName } from '@/backend/utils/runtimeEnv';
import { storeSet } from '@/backend/infrastructure/settings/store';
import { OPENAI_SUBTITLE_CUSTOM_STYLE_KEY, getSubtitleDefaultStyle } from '@/common/constants/openaiSubtitlePrompts';

const DEFAULT_OPENAI_MODEL = 'gpt-5.2';
const MIGRATION_ID = 'store-schema-provider-v1';

const settingsStore = new Store<Record<string, unknown>>({
    name: getEnvironmentConfigName('config'),
});

const getPersistedString = (key: string): string | null => {
    const value = settingsStore.get(key);
    if (typeof value !== 'string') {
        return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
};

const parseOpenAiModels = (raw: string | null): string[] => {
    if (!raw) {
        return [DEFAULT_OPENAI_MODEL];
    }

    const parsed = raw
        .split(/[\n,]/)
        .map((item) => item.trim())
        .filter((item) => item.length > 0);

    const deduped = Array.from(new Set(parsed));
    if (deduped.length === 0) {
        return [DEFAULT_OPENAI_MODEL];
    }

    return deduped;
};

const normalizeSubtitleEngine = (value: string | null): 'openai' | 'tencent' | 'none' => {
    if (value === 'openai' || value === 'tencent' || value === 'none') {
        return value;
    }
    return 'openai';
};

const normalizeDictionaryEngine = (value: string | null): 'openai' | 'youdao' | 'none' => {
    if (value === 'openai' || value === 'youdao' || value === 'none') {
        return value;
    }
    return 'openai';
};

const normalizeTranscriptionEngine = (value: string | null): 'openai' | 'whisper' | 'none' => {
    if (value === 'openai' || value === 'whisper' || value === 'none') {
        return value;
    }
    return 'openai';
};

const resolveModelFromAvailable = (candidate: string | null, availableModels: string[]): string => {
    if (candidate && availableModels.includes(candidate)) {
        return candidate;
    }

    return availableModels[0] ?? DEFAULT_OPENAI_MODEL;
};

const getLegacySubtitleCustomStyle = async (): Promise<string | null> => {
    const result = await db
        .select({ value: systemConfigs.value })
        .from(systemConfigs)
        .where(eq(systemConfigs.key, OPENAI_SUBTITLE_CUSTOM_STYLE_KEY))
        .limit(1);

    const style = result[0]?.value;
    if (typeof style !== 'string') {
        return null;
    }

    const trimmed = style.trim();
    return trimmed.length > 0 ? trimmed : null;
};

export const storeSchemaProviderMigrationV1 = {
    id: MIGRATION_ID,
    description: 'Migrate legacy store schema provider keys to new provider/features/models keys',
    run: async (): Promise<void> => {
        const subtitleEngine = normalizeSubtitleEngine(
            getPersistedString('providers.subtitleTranslation')
            ?? (getPersistedString('subtitleTranslation.engine') === 'tencent' ? 'tencent' : 'openai')
        );

        const dictionaryEngine = normalizeDictionaryEngine(
            getPersistedString('providers.dictionary')
            ?? (getPersistedString('dictionary.engine') === 'youdao' ? 'youdao' : 'openai')
        );

        const transcriptionEngine = normalizeTranscriptionEngine(
            getPersistedString('providers.transcription')
            ?? (getPersistedString('transcription.engine') === 'whisper' ? 'whisper' : 'openai')
        );

        const sentenceLearningEnabled =
            (getPersistedString('features.openai.enableSentenceLearning')
                ?? (getPersistedString('services.openai.enableSentenceLearning') === 'false' ? 'false' : 'true')) === 'false'
                ? 'false'
                : 'true';

        const subtitleModeRaw = getPersistedString('features.openai.subtitleTranslationMode')
            ?? getPersistedString('services.openai.subtitleTranslationMode');

        const subtitleMode = subtitleModeRaw === 'simple_en' || subtitleModeRaw === 'custom' ? subtitleModeRaw : 'zh';

        const persistedCustomStyle = getPersistedString('features.openai.subtitleCustomStyle');
        const legacyCustomStyle = await getLegacySubtitleCustomStyle();
        const subtitleCustomStyle = persistedCustomStyle ?? legacyCustomStyle ?? getSubtitleDefaultStyle('custom');

        const legacyDefaultModel = getPersistedString('model.gpt.default');
        const availableModels = parseOpenAiModels(
            getPersistedString('models.openai.available') ?? legacyDefaultModel
        );

        const availableModelsValue = availableModels.join(',');

        const sentenceLearningModel = resolveModelFromAvailable(
            getPersistedString('models.openai.sentenceLearning') ?? legacyDefaultModel,
            availableModels,
        );
        const subtitleTranslationModel = resolveModelFromAvailable(
            getPersistedString('models.openai.subtitleTranslation') ?? legacyDefaultModel,
            availableModels,
        );
        const dictionaryModel = resolveModelFromAvailable(
            getPersistedString('models.openai.dictionary') ?? legacyDefaultModel,
            availableModels,
        );

        storeSet('providers.subtitleTranslation', subtitleEngine);
        storeSet('providers.dictionary', dictionaryEngine);
        storeSet('providers.transcription', transcriptionEngine);

        storeSet('features.openai.enableSentenceLearning', sentenceLearningEnabled);
        storeSet('features.openai.subtitleTranslationMode', subtitleMode);
        storeSet('features.openai.subtitleCustomStyle', subtitleCustomStyle);

        storeSet('models.openai.available', availableModelsValue);
        storeSet('models.openai.sentenceLearning', sentenceLearningModel);
        storeSet('models.openai.subtitleTranslation', subtitleTranslationModel);
        storeSet('models.openai.dictionary', dictionaryModel);
    },
};
