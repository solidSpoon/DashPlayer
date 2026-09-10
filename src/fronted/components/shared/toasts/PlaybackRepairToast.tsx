import React from 'react';
import { Button } from '@/fronted/components/ui/button';
import { useTranslation } from 'react-i18next';
import { RepairReason } from '@/common/contracts/playback-repair';

/**
 * 修复提示的触发场景。
 *
 * `stall` 表示播放卡死或媒体报错，其余取值来自后端诊断结论。
 */
export type RepairToastVariant = 'stall' | RepairReason;

interface PlaybackRepairToastProps {
    /** 触发场景，决定标题与说明文案。 */
    variant: RepairToastVariant;
    onRepair: () => void;
    onIgnore: () => void;
}

/**
 * 把触发场景映射到文案键，未知场景回退到通用「可能无法播放」文案。
 *
 * @param variant 触发场景。
 * @returns 标题与说明的 i18n 键后缀。
 */
function copyKeys(variant: RepairToastVariant): { title: string; description: string } {
    switch (variant) {
        case 'mp3-seek-imprecise':
            return { title: 'seekTitle', description: 'seekDescription' };
        case 'unsupported-audio':
            return { title: 'silentTitle', description: 'silentDescription' };
        case 'stall':
            return { title: 'stallTitle', description: 'stallDescription' };
        case 'unsupported-container':
        case 'undecodable-video':
        case 'playable':
        case 'already-repaired':
        default:
            return { title: 'unplayableTitle', description: 'unplayableDescription' };
    }
}

/**
 * 播放问题提示：说明问题原因，并提供一个「修复播放问题」入口。
 */
export function PlaybackRepairToast({ variant, onRepair, onIgnore }: PlaybackRepairToastProps) {
    const { t } = useTranslation('player');
    const keys = copyKeys(variant);

    return (
        <div className="flex flex-col gap-3 py-1">
            <div className="flex flex-col gap-1">
                <div className="font-semibold text-sm leading-snug">
                    {t(`repair.${keys.title}`)}
                </div>
                <div className="text-xs text-muted-foreground leading-relaxed">
                    {t(`repair.${keys.description}`)}
                </div>
            </div>
            <div className="flex items-center justify-end gap-2">
                <Button
                    variant="outline"
                    size="sm"
                    className="h-7 px-3 text-xs"
                    onClick={onIgnore}
                >
                    {t('repair.ignore')}
                </Button>
                <Button
                    size="sm"
                    className="h-7 px-3 text-xs"
                    onClick={onRepair}
                >
                    {t('repair.action')}
                </Button>
            </div>
        </div>
    );
}
