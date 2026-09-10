import React from 'react';
import { codeBlock } from 'common-tags';
import { Wrench } from 'lucide-react';
import TooltippedButton from '@/fronted/components/shared/common/TooltippedButton';
import useFile from '@/fronted/features/file-browser/fileStore';
import StrUtil from '@/common/utils/str-util';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { repairPlayback } from '@/fronted/features/player/repairPlayback';

/** 播放修复按钮属性。 */
interface RepairPlaybackButtonProps {
    /** 外部样式类名。 */
    className?: string;
}

/**
 * 常驻的「修复播放问题」入口：让用户不必等到出现提示就能主动修复当前媒体。
 *
 * @param props 按钮样式属性。
 * @returns 播放修复按钮。
 */
export default function RepairPlaybackButton({ className }: RepairPlaybackButtonProps) {
    const { t } = useI18nTranslation('player');
    const videoPath = useFile((s) => s.videoPath);
    const canRepair = !StrUtil.isBlank(videoPath);

    const tooltipMd = codeBlock`
  #### ${t('repair.tooltipTitle')}
  ${t('repair.tooltipBody')}
  `;

    return (
        <TooltippedButton
            icon={Wrench}
            text={t('repair.action')}
            disabled={!canRepair}
            onClick={() => {
                if (videoPath === null || StrUtil.isBlank(videoPath)) {
                    return;
                }
                void repairPlayback(videoPath);
            }}
            tooltipMd={tooltipMd}
            variant="ghost"
            className={className}
        />
    );
}
