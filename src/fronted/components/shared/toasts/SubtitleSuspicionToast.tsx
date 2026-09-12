import React from 'react';
import { Button } from '@/fronted/components/ui/button';
import { useTranslation } from 'react-i18next';
import { SubtitleSuspicionReason } from '@/fronted/features/player/subtitleSuspicion';

interface SubtitleSuspicionToastProps {
    /** 触发原因，决定提示文案；可同时出现多条。 */
    reasons: SubtitleSuspicionReason[];
    onGenerate: () => void;
    onIgnore: () => void;
}

/** 各原因对应的说明文案键。 */
const DESCRIPTION_KEYS: Record<SubtitleSuspicionReason, string> = {
    'no-subtitle': 'noSubtitleDescription',
    'name-mismatch': 'nameMismatchDescription',
    'chinese-only': 'chineseOnlyDescription',
};

/**
 * 字幕可疑提示：说明当前字幕可能不对的原因，并提供一个「生成字幕」入口。
 */
export function SubtitleSuspicionToast({ reasons, onGenerate, onIgnore }: SubtitleSuspicionToastProps) {
    const { t } = useTranslation('player');

    return (
        <div className="flex flex-col gap-3 py-1">
            <div className="flex flex-col gap-1">
                <div className="font-semibold text-sm leading-snug">
                    {t('subtitleMismatch.title')}
                </div>
                {reasons.map((reason) => (
                    <div key={reason} className="text-xs text-muted-foreground leading-relaxed">
                        {t(`subtitleMismatch.${DESCRIPTION_KEYS[reason]}`)}
                    </div>
                ))}
            </div>
            <div className="flex items-center justify-end gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-3 text-xs"
                    onClick={onIgnore}
                >
                    {t('subtitleMismatch.ignore')}
                </Button>
                <Button
                    size="sm"
                    className="h-7 px-3 text-xs"
                    onClick={onGenerate}
                >
                    {t('subtitleMismatch.generate')}
                </Button>
            </div>
        </div>
    );
}
