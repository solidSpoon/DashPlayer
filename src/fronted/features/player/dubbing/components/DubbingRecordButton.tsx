import { useTranslation } from 'react-i18next';
import { Loader2, Mic, Square } from 'lucide-react';

import useFile from '@/fronted/features/file-browser/fileStore';
import { cn } from '@/fronted/lib/utils';
import {
    CAPTION_CARD_BUTTON_CLASS,
    CAPTION_CARD_IDLE_CLASS,
    captionCardActiveClass,
} from '@/fronted/features/player/components/captionCardShell';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/fronted/components/ui/tooltip';
import { useDubbing } from '../dubbingStore';
import { dubbingControls } from '../dubbingControls';

/**
 * 配音录制按钮（主字幕区右下角胶囊控制栏）：点击开始/停止录制当前句，与 Q 键等效。
 *
 * 按钮始终只放一枚图标，各阶段宽度完全一致（录音中红色方块、保存中转圈、回放中蓝色麦克风），
 * 不出现文字导致的宽度跳变；自身为 24px 正圆，与胶囊内其余按钮同款。
 * 录音计时与处理进度由胶囊左侧的录音卡片展示（见 DubbingTakeChip）。
 */
export default function DubbingRecordButton() {
    const { t } = useTranslation('player');

    const phase = useDubbing((s) => s.phase);
    const srtHash = useFile((s) => s.srtHash);

    if (!srtHash) {
        return null;
    }

    const tooltip = phase === 'recording'
        ? t('dubbing.stop')
        : phase === 'saving'
            ? t('dubbing.saving')
            : phase === 'replaying'
                ? t('dubbing.skipReplay')
                : t('dubbing.record');

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <button
                    onClick={() => dubbingControls.primary()}
                    aria-label={tooltip}
                    className={cn(
                        CAPTION_CARD_BUTTON_CLASS,
                        phase === 'recording' ? captionCardActiveClass('red') : CAPTION_CARD_IDLE_CLASS
                    )}
                >
                    {phase === 'recording' ? (
                        <Square className="w-3.5 h-3.5 fill-current animate-pulse" />
                    ) : phase === 'saving' ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : phase === 'replaying' ? (
                        <Mic className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400 animate-pulse" />
                    ) : (
                        <Mic className="w-3.5 h-3.5" />
                    )}
                </button>
            </TooltipTrigger>
            <TooltipContent side="top">{tooltip}</TooltipContent>
        </Tooltip>
    );
}
