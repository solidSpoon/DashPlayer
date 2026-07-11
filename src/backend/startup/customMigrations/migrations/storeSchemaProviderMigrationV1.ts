import Store from 'electron-store';
import { eq } from 'drizzle-orm';

import db from '@/backend/infrastructure/db';
import { systemConfigs } from '@/backend/infrastructure/db/tables/sysConf';
import { getEnvironmentConfigName } from '@/backend/utils/runtimeEnv';
import { storeSet } from '@/backend/infrastructure/settings/store';
import { OPENAI_SUBTITLE_CUSTOM_STYLE_KEY } from '@/common/constants/openaiSubtitlePrompts';

const DEFAULT_OPENAI_MODEL = 'gpt-5.4-nano';
const MIGRATION_ID = 'store-schema-provider-v1';

const settingsStore = new Store<Record<string, unknown>>({
    name: getEnvironmentConfigName('config'),
});

/**
 * 读取 store 中“用户真实持久化过”的非空字符串。
 */
const getPersistedString = (key: string): string | null => {
    const value = settingsStore.get(key);
    if (typeof value !== 'string') {
        return null;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
};

/**
 * 仅在目标值存在时写回新 schema，避免把默认推断结果固化到老用户配置。
 */
const storeSetIfPresent = (key: Parameters<typeof storeSet>[0], value: string | null): void => {
    if (value === null) {
        return;
    }
    storeSet(key, value);
};

/**
 * 解析 OpenAI 模型列表；仅在用户明确配置过时返回结果。
 */
const parseOpenAiModels = (raw: string | null): string[] => {
    if (!raw) {
        return [];
    }

    const parsed = raw
        .split(/[\n,]/)
        .map((item) => item.trim())
        .filter((item) => item.length > 0);

    const deduped = Array.from(new Set(parsed));
    return deduped;
};

/**
 * 校验字幕翻译引擎值；空值表示旧配置未显式设置。
 */
const normalizeSubtitleEngine = (value: string | null): 'openai' | 'tencent' | 'none' => {
    if (value === 'openai' || value === 'tencent' || value === 'none') {
        return value;
    }
    return 'none';
};

/**
 * 校验词典引擎值；空值表示旧配置未显式设置。
 */
const normalizeDictionaryEngine = (value: string | null): 'openai' | 'youdao' | 'none' => {
    if (value === 'openai' || value === 'youdao' || value === 'none') {
        return value;
    }
    return 'none';
};

/**
 * 在候选模型存在且可用时保留原值，否则回退到可用列表首项。
 */
const resolveModelFromAvailable = (candidate: string | null, availableModels: string[]): string | null => {
    if (candidate && availableModels.includes(candidate)) {
        return candidate;
    }

    return availableModels[0] ?? null;
};

/**
 * 从旧 sysConf 中读取字幕自定义风格，仅迁移用户显式保存过的内容。
 */
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
        const persistedSubtitleProvider = getPersistedString('providers.subtitleTranslation');
        const persistedLegacySubtitleProvider = getPersistedString('subtitleTranslation.engine');
        const subtitleEngine = normalizeSubtitleEngine(
            persistedSubtitleProvider
            ?? (persistedLegacySubtitleProvider === null ? null : persistedLegacySubtitleProvider)
        );

        const persistedDictionaryProvider = getPersistedString('providers.dictionary');
        const persistedLegacyDictionaryProvider = getPersistedString('dictionary.engine');
        const dictionaryEngine = normalizeDictionaryEngine(
            persistedDictionaryProvider
            ?? (persistedLegacyDictionaryProvider === null ? null : persistedLegacyDictionaryProvider)
        );

        const persistedSentenceLearningEnabled = getPersistedString('features.openai.enableSentenceLearning')
            ?? getPersistedString('services.openai.enableSentenceLearning');
        const sentenceLearningEnabled = persistedSentenceLearningEnabled === null
            ? null
            : (persistedSentenceLearningEnabled === 'false' ? 'false' : 'true');

        const subtitleModeRaw = getPersistedString('features.openai.subtitleTranslationMode')
            ?? getPersistedString('services.openai.subtitleTranslationMode');

        const subtitleMode = subtitleModeRaw === null
            ? null
            : (subtitleModeRaw === 'simple_en' || subtitleModeRaw === 'custom' ? subtitleModeRaw : 'zh');

        const persistedCustomStyle = getPersistedString('features.openai.subtitleCustomStyle');
        const legacyCustomStyle = await getLegacySubtitleCustomStyle();
        const subtitleCustomStyle = persistedCustomStyle ?? legacyCustomStyle;

        const persistedAvailableModels = getPersistedString('models.openai.available');
        const legacyDefaultModel = getPersistedString('model.gpt.default');
        const availableModels = parseOpenAiModels(persistedAvailableModels ?? legacyDefaultModel);

        const availableModelsValue = availableModels.join(',');

        const sentenceLearningModel = resolveModelFromAvailable(
            getPersistedString('models.openai.sentenceLearning') ?? legacyDefaultModel ?? DEFAULT_OPENAI_MODEL,
            availableModels,
        );
        const subtitleTranslationModel = resolveModelFromAvailable(
            getPersistedString('models.openai.subtitleTranslation') ?? legacyDefaultModel ?? DEFAULT_OPENAI_MODEL,
            availableModels,
        );
        const dictionaryModel = resolveModelFromAvailable(
            getPersistedString('models.openai.dictionary') ?? legacyDefaultModel ?? DEFAULT_OPENAI_MODEL,
            availableModels,
        );

        storeSetIfPresent('providers.subtitleTranslation', subtitleEngine === 'none' ? null : subtitleEngine);
        storeSetIfPresent('providers.dictionary', dictionaryEngine === 'none' ? null : dictionaryEngine);
        storeSetIfPresent('features.openai.enableSentenceLearning', sentenceLearningEnabled);
        storeSetIfPresent('features.openai.subtitleTranslationMode', subtitleMode);
        storeSetIfPresent('features.openai.subtitleCustomStyle', subtitleCustomStyle);

        storeSetIfPresent('models.openai.available', availableModelsValue.length > 0 ? availableModelsValue : null);
        storeSetIfPresent('models.openai.sentenceLearning', sentenceLearningModel);
        storeSetIfPresent('models.openai.subtitleTranslation', subtitleTranslationModel);
        storeSetIfPresent('models.openai.dictionary', dictionaryModel);
    },
};
