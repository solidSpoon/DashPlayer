import { useTranslation } from 'react-i18next';
import { Loader2, Mic, Square } from 'lucide-react';

import useFile from '@/fronted/features/file-browser/fileStore';
import useSetting from '@/fronted/features/settings/settingsStore';
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
 * 配音录制按钮（主字幕区右下角胶囊控制栏）：按住开始录制当前句（越过长按阈值才开麦），松手即停并保存；
 * 短按则试听本句已有录音（没录过则无动作），与 Q 键等效。
 *
 * 按钮始终只放一枚图标，各阶段宽度完全一致（预备中麦克风脉冲、录音中红色方块、
 * 保存中转圈），不出现文字导致的宽度跳变；自身为 24px 正圆，与胶囊内其余按钮同款。
 * 录音计时、配合与处理状态由胶囊左侧的录音卡片展示（见 DubbingTakeChip）。
 */
export default function DubbingRecordButton() {
    const { t } = useTranslation('player');

    const phase = useDubbing((s) => s.phase);
    const srtHash = useFile((s) => s.srtHash);
    const recordShortcut = useSetting((s) => s.setting('shortcut.dubbingRecord'));

    if (!srtHash) {
        return null;
    }

    const shortcutSuffix = recordShortcut ? ` (${recordShortcut.split(',')[0].toUpperCase()})` : '';
    const tooltip = phase === 'preparing'
        ? t('dubbing.preparing')
        : phase === 'recording'
            ? t('dubbing.stop')
            : phase === 'saving'
                ? t('dubbing.saving')
                : `${t('dubbing.record')}${shortcutSuffix}`;

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <button
                    // 按住说话：按下只开始长按判定，松开才决定是停录还是试听，所以不能退化成一次点击
                    onPointerDown={(event) => {
                        if (event.button !== 0) {
                            return;
                        }
                        // 指针捕获：光标按住后拖出按钮也能收到抬起事件，不会把录音挂在那里
                        event.currentTarget.setPointerCapture(event.pointerId);
                        dubbingControls.pressStart();
                    }}
                    onPointerUp={() => dubbingControls.pressEnd()}
                    onPointerCancel={() => dubbingControls.pressEnd()}
                    onKeyDown={(event) => {
                        if ((event.key !== ' ' && event.key !== 'Enter') || event.repeat) {
                            return;
                        }
                        event.preventDefault();
                        dubbingControls.pressStart();
                    }}
                    onKeyUp={(event) => {
                        if (event.key !== ' ' && event.key !== 'Enter') {
                            return;
                        }
                        event.preventDefault();
                        dubbingControls.pressEnd();
                    }}
                    aria-label={tooltip}
                    className={cn(
                        CAPTION_CARD_BUTTON_CLASS,
                        phase === 'recording' ? captionCardActiveClass('red') : CAPTION_CARD_IDLE_CLASS
                    )}
                >
                    {phase === 'preparing' ? (
                        <Mic className="w-3.5 h-3.5 animate-pulse" />
                    ) : phase === 'recording' ? (
                        <Square className="w-3.5 h-3.5 fill-current animate-pulse" />
                    ) : phase === 'saving' ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                        <Mic className="w-3.5 h-3.5" />
                    )}
                </button>
            </TooltipTrigger>
            <TooltipContent side="top">{tooltip}</TooltipContent>
        </Tooltip>
    );
}
