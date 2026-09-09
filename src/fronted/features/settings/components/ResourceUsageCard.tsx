import React from 'react';
import { useTranslation } from 'react-i18next';
import { cn } from '@/fronted/lib/utils';
import type { ResourceFallbackSnapshot } from '@/common/contracts/resource-fallback';
import type { TranscriptionEngine } from '@/common/contracts/transcription-engine';

/** 资源档位：云端 / 增强 / 基础 / 关闭。 */
type UsageTier = 'cloud' | 'enhance' | 'base' | 'off';

/** 一行"当前使用"的展示数据。 */
interface UsageRow {
    key: string;
    /** 功能名，如"字幕翻译"。 */
    label: string;
    /** 此刻实际生效的档位。 */
    tier: UsageTier;
    /** 档位细节：模型名、内置模型或识别方式。 */
    detail?: string;
    /** 发生回退时的提示；未回退时不展示。 */
    fallback?: string;
}

/** 档位文案键。 */
const TIER_LABEL_KEYS: Record<UsageTier, string> = {
    cloud: 'resources.usage.tierCloud',
    enhance: 'resources.usage.tierEnhance',
    base: 'resources.usage.tierBase',
    off: 'resources.usage.tierOff',
};

/** 档位徽标配色：云端与增强用彩色，基础与关闭用中性色。 */
const TIER_BADGE_STYLES: Record<UsageTier, string> = {
    cloud: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    enhance: 'bg-violet-500/10 text-violet-600 dark:text-violet-400',
    base: 'bg-muted text-muted-foreground',
    off: 'bg-muted text-muted-foreground',
};

export interface ResourceUsageCardProps {
    /** 字幕翻译引擎。 */
    subtitleEngine: string;
    /** 字幕翻译使用的云端模型；非云端时忽略。 */
    subtitleModel: string;
    /** 词典补充方式。 */
    dictionaryEngine: string;
    /** 词典补充使用的云端模型；非云端时忽略。 */
    dictionaryModel: string;
    /** 是否启用整句讲解。 */
    sentenceLearningEnabled: boolean;
    /** 整句讲解使用的云端模型。 */
    sentenceModel: string;
    /** 字幕识别方式。 */
    transcriptionEngine: TranscriptionEngine;
    /** 回退状态；未加载时为 null。 */
    fallback: ResourceFallbackSnapshot | null;
}

/**
 * 「当前使用」卡片：一眼看清每个功能此刻实际调用的资源。
 *
 * 与偏好里的下拉不同，这里回答的是"现在到底谁在干活"——云端或增强不可用时，
 * 会显示已回退到哪一档基础资源。
 */
export const ResourceUsageCard: React.FC<ResourceUsageCardProps> = ({
    subtitleEngine,
    subtitleModel,
    dictionaryEngine,
    dictionaryModel,
    sentenceLearningEnabled,
    sentenceModel,
    transcriptionEngine,
    fallback,
}) => {
    const { t } = useTranslation('settings');

    /** 把回退来源标识翻译成档位名：云端引擎为 openai，其余是增强模型标识。 */
    const tierLabelOf = (from: string): string => (
        from === 'openai' ? t('resources.usage.tierCloud') : t('resources.usage.tierEnhance')
    );
    /** 回退提示文案；未回退时为 undefined。 */
    const fallbackText = (
        state: ResourceFallbackSnapshot['subtitleTranslation'],
        targetLabel: string,
    ): string | undefined => state
        ? t('resources.usage.fallback', { from: tierLabelOf(state.from), to: targetLabel })
        : undefined;

    const subtitleRow: UsageRow = (() => {
        const base = { key: 'subtitle', label: t('resources.usage.subtitle') };
        if (subtitleEngine === 'openai') {
            return { ...base, tier: 'cloud', detail: subtitleModel };
        }
        if (subtitleEngine === 'local') {
            return { ...base, tier: 'enhance', detail: t('serviceCredentials.localAi.builtinModelName') };
        }
        if (subtitleEngine === 'local-mt') {
            return { ...base, tier: 'base', detail: t('resources.pack.itemMt') };
        }
        return { ...base, tier: 'off' };
    })();

    /** 词典当前档位：内置词库始终参与，云端/增强只是补充。 */
    const dictionaryRow: UsageRow = (() => {
        const base = { key: 'dictionary', label: t('resources.usage.dictionary'), tier: 'base' as UsageTier };
        const supplement = dictionaryEngine === 'openai'
            ? dictionaryModel
            : dictionaryEngine === 'local'
                ? t('resources.preference.engineLocalAi')
                : null;
        return {
            ...base,
            detail: supplement
                ? `${t('resources.usage.builtinDictionary')} · ${t('resources.usage.supplement', { resource: supplement })}`
                : t('resources.usage.noSupplement'),
        };
    })();

    const rows: UsageRow[] = [
        {
            ...subtitleRow,
            fallback: fallbackText(fallback?.subtitleTranslation ?? null, t('resources.pack.itemMt')),
        },
        {
            ...dictionaryRow,
            fallback: fallbackText(fallback?.dictionary ?? null, t('resources.usage.builtinDictionary')),
        },
        {
            key: 'sentence',
            label: t('resources.usage.sentence'),
            tier: sentenceLearningEnabled ? 'cloud' : 'off',
            detail: sentenceLearningEnabled ? sentenceModel : undefined,
        },
        {
            key: 'transcription',
            label: t('resources.usage.transcription'),
            tier: 'base',
            detail: transcriptionEngine === 'whisper-cpp'
                ? t('resources.usage.transcriptionHardware')
                : t('resources.usage.transcriptionCompat'),
        },
        {
            key: 'tts',
            label: t('resources.usage.tts'),
            tier: 'base',
        },
    ];

    return (
        <div className="divide-y divide-border/50">
            {rows.map((row) => (
                <div
                    key={row.key}
                    className="flex flex-col gap-1.5 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between"
                >
                    <div className="flex items-center gap-2 min-w-0">
                        <span className="text-sm font-medium text-foreground">{row.label}</span>
                        <span className={cn(
                            'shrink-0 rounded-full px-2 py-0.5 text-xs font-medium',
                            TIER_BADGE_STYLES[row.tier],
                        )}>
                            {t(TIER_LABEL_KEYS[row.tier])}
                        </span>
                        {row.detail && (
                            <span className="truncate text-xs text-muted-foreground">{row.detail}</span>
                        )}
                    </div>
                    {row.fallback && (
                        <span className="shrink-0 text-xs text-amber-600 dark:text-amber-400">
                            {row.fallback}
                        </span>
                    )}
                </div>
            ))}
        </div>
    );
};

export default ResourceUsageCard;
