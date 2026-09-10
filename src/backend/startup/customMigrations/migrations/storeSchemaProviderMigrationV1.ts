import { eq } from 'drizzle-orm';

import { systemConfigs } from '@/backend/infrastructure/db/tables/sysConf';
import { OPENAI_SUBTITLE_CUSTOM_STYLE_KEY } from '@/common/constants/openaiSubtitlePrompts';
import type { SettingKey } from '@/common/types/store_schema';
import type { Db } from '@/backend/infrastructure/db/createDb';

import type { CustomMigration } from '../types';

const DEFAULT_OPENAI_MODEL = 'gpt-5.4-nano';

/**
 * 旧配置里读到的全部线索；键对应历史 schema 键名，值均为「真实持久化过」的原始串。
 * 字段名不带 legacy 前缀的是新 schema 键，带 legacy 的是旧 schema / 旧 sysConf 来源。
 */
export interface ProviderMigrationReads {
    subtitleProvider: string | null;
    legacySubtitleProvider: string | null;
    dictionaryProvider: string | null;
    legacyDictionaryProvider: string | null;
    sentenceLearningEnabled: string | null;
    legacySentenceLearningEnabled: string | null;
    subtitleMode: string | null;
    legacySubtitleMode: string | null;
    subtitleCustomStyle: string | null;
    legacySysConfSubtitleCustomStyle: string | null;
    availableModels: string | null;
    legacyDefaultModel: string | null;
    sentenceLearningModel: string | null;
    subtitleTranslationModel: string | null;
    dictionaryModel: string | null;
}

/** 迁移产出的单个写入项。 */
export interface ProviderMigrationWrite {
    key: SettingKey;
    value: string;
}

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
 *
 * 'youdao' 链路已随有道下线整体移除，这里不再把 youdao 原样写出（那会让
 * 同批的 V2 迁移再擦一次，形成自产自销的双轨）：直接归一为默认值语义，
 * 由 schema 默认 'openai' 接管；未配置 key 时预置词典仍然可用。
 */
const normalizeDictionaryEngine = (value: string | null): 'openai' | 'none' => {
    if (value === 'openai' || value === 'none') {
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
 * 从旧配置线索计算迁移写入项（纯函数，便于单测）。
 *
 * 语义与历史行为一致：
 * - 引擎值为 none/未知时不写盘，交给 schema 默认值，避免把推断结果固化到用户配置；
 * - 句子学习开关只在旧配置显式持久化过时写回 true/false；
 * - 翻译模式仅认 simple_en/custom，其余一律归 zh；
 * - 模型候选不在可用列表时回落可用列表首项，再回落内置默认模型；
 * - 可用模型列表为空时不写模型相关键。
 *
 * @param reads 旧配置线索（新键、历史键与旧 sysConf 的持久化值）。
 * @returns 按历史写入顺序排列的写入项。
 */
export const resolveProviderMigrationOutputs = (reads: ProviderMigrationReads): ProviderMigrationWrite[] => {
    const subtitleEngine = normalizeSubtitleEngine(reads.subtitleProvider ?? reads.legacySubtitleProvider);
    const dictionaryEngine = normalizeDictionaryEngine(reads.dictionaryProvider ?? reads.legacyDictionaryProvider);

    const persistedSentenceLearningEnabled = reads.sentenceLearningEnabled ?? reads.legacySentenceLearningEnabled;
    const sentenceLearningEnabled = persistedSentenceLearningEnabled === null
        ? null
        : (persistedSentenceLearningEnabled === 'false' ? 'false' : 'true');

    const subtitleModeRaw = reads.subtitleMode ?? reads.legacySubtitleMode;
    const subtitleMode = subtitleModeRaw === null
        ? null
        : (subtitleModeRaw === 'simple_en' || subtitleModeRaw === 'custom' ? subtitleModeRaw : 'zh');

    const subtitleCustomStyle = reads.subtitleCustomStyle ?? reads.legacySysConfSubtitleCustomStyle;

    const availableModels = parseOpenAiModels(reads.availableModels ?? reads.legacyDefaultModel);
    const availableModelsValue = availableModels.join(',');

    const sentenceLearningModel = resolveModelFromAvailable(
        reads.sentenceLearningModel ?? reads.legacyDefaultModel ?? DEFAULT_OPENAI_MODEL,
        availableModels,
    );
    const subtitleTranslationModel = resolveModelFromAvailable(
        reads.subtitleTranslationModel ?? reads.legacyDefaultModel ?? DEFAULT_OPENAI_MODEL,
        availableModels,
    );
    const dictionaryModel = resolveModelFromAvailable(
        reads.dictionaryModel ?? reads.legacyDefaultModel ?? DEFAULT_OPENAI_MODEL,
        availableModels,
    );

    const writes: ProviderMigrationWrite[] = [];
    if (subtitleEngine !== 'none') {
        writes.push({ key: 'providers.subtitleTranslation', value: subtitleEngine });
    }
    if (dictionaryEngine !== 'none') {
        writes.push({ key: 'providers.dictionary', value: dictionaryEngine });
    }
    if (sentenceLearningEnabled !== null) {
        writes.push({ key: 'features.openai.enableSentenceLearning', value: sentenceLearningEnabled });
    }
    if (subtitleMode !== null) {
        writes.push({ key: 'features.openai.subtitleTranslationMode', value: subtitleMode });
    }
    if (subtitleCustomStyle !== null) {
        writes.push({ key: 'features.openai.subtitleCustomStyle', value: subtitleCustomStyle });
    }
    if (availableModelsValue.length > 0) {
        writes.push({ key: 'models.openai.available', value: availableModelsValue });
    }
    if (sentenceLearningModel !== null) {
        writes.push({ key: 'models.openai.sentenceLearning', value: sentenceLearningModel });
    }
    if (subtitleTranslationModel !== null) {
        writes.push({ key: 'models.openai.subtitleTranslation', value: subtitleTranslationModel });
    }
    if (dictionaryModel !== null) {
        writes.push({ key: 'models.openai.dictionary', value: dictionaryModel });
    }
    return writes;
};

/**
 * 从旧 sysConf 中读取字幕自定义风格，仅迁移用户显式保存过的内容。
 */
const getLegacySubtitleCustomStyle = async (db: Db): Promise<string | null> => {
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

export const storeSchemaProviderMigrationV1: CustomMigration = {
    id: 'store-schema-provider-v1',
    description: 'Migrate legacy store schema provider keys to new provider/features/models keys',
    /**
     * 把旧 schema 的服务/模型键重构为新 schema。
     *
     * 读取走 ctx.settings（单例通道），决策收敛在纯函数
     * resolveProviderMigrationOutputs 里；产出为空时不写任何键。
     */
    run: async (ctx) => {
        const reads: ProviderMigrationReads = {
            subtitleProvider: ctx.settings.getPersisted('providers.subtitleTranslation'),
            legacySubtitleProvider: ctx.settings.getPersisted('subtitleTranslation.engine'),
            dictionaryProvider: ctx.settings.getPersisted('providers.dictionary'),
            legacyDictionaryProvider: ctx.settings.getPersisted('dictionary.engine'),
            sentenceLearningEnabled: ctx.settings.getPersisted('features.openai.enableSentenceLearning'),
            legacySentenceLearningEnabled: ctx.settings.getPersisted('services.openai.enableSentenceLearning'),
            subtitleMode: ctx.settings.getPersisted('features.openai.subtitleTranslationMode'),
            legacySubtitleMode: ctx.settings.getPersisted('services.openai.subtitleTranslationMode'),
            subtitleCustomStyle: ctx.settings.getPersisted('features.openai.subtitleCustomStyle'),
            legacySysConfSubtitleCustomStyle: await getLegacySubtitleCustomStyle(ctx.db),
            availableModels: ctx.settings.getPersisted('models.openai.available'),
            legacyDefaultModel: ctx.settings.getPersisted('model.gpt.default'),
            sentenceLearningModel: ctx.settings.getPersisted('models.openai.sentenceLearning'),
            subtitleTranslationModel: ctx.settings.getPersisted('models.openai.subtitleTranslation'),
            dictionaryModel: ctx.settings.getPersisted('models.openai.dictionary'),
        };

        const outputs = resolveProviderMigrationOutputs(reads);
        for (const { key, value } of outputs) {
            ctx.settings.set(key, value);
        }
        ctx.logger.info('provider schema migration applied', {
            writtenKeys: outputs.map((output) => output.key),
        });
    },
};
