import { useEffect, useRef, useState } from 'react';
import { Pin } from 'lucide-react';
import { cn } from '@/fronted/lib/utils';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/fronted/components/ui/tooltip';
import { usePlayerUi } from '@/fronted/features/player/playerUiStore';
import { usePlayer } from '@/fronted/features/player/playerStore';
import { DARK_BAR_BUTTON_HOVER } from '@/fronted/features/player/components/PlaybackGlobalControls';

/** 训练提醒动效时长（毫秒）：进度类训练模式开启且未钉住时，轻轻呼吸几秒后自行收起。 */
const PIN_NUDGE_DURATION_MS = 4000;

/** 会展示进度的训练模式标识（单句循环 / 句末自动暂停不展示进度，不在其中）。 */
type ProgressMode = 'loopTimes' | 'loopRates' | 'shadowing';

/**
 * 视频控制条的「钉住」开关。
 *
 * 打开后控制条不再自动淡出（普通视图条的超时隐藏、全屏条的鼠标移出隐藏都失效），
 * 训练时可以一直盯着进度条与当前遍数。普通视图与全屏两条控制条共用同一个开关，
 * 状态持久化在播放器 UI 偏好里，跨重启保留。
 *
 * 开启了会显示进度的训练模式（逐句重复 / 递进倍速精听 / 影子跟读）却还没钉住时，
 * 按钮会轻轻呼吸几秒提示可以钉住，免得进度随控制条自动隐藏而看不到；只是短暂提示，
 * 几秒后自行收起，不常驻闪烁。三种进度模式之间互相切换时也会重新提醒一次。
 *
 * @returns 钉住开关按钮。
 */
export default function ControlBarPinButton() {
    const pinned = usePlayerUi((s) => s.controlBarPinned);
    const toggle = usePlayerUi((s) => s.toggleControlBarPinned);
    // 逐句循环（重复×N / 倍速精听）与影子跟读会展示进度；单句循环/句末暂停会清空 sentenceLoop，故天然排除
    const sentenceLoop = usePlayer((s) => s.sentenceLoop);
    const shadowing = usePlayer((s) => s.shadowing);
    let progressMode: ProgressMode | null = null;
    if (sentenceLoop) {
        progressMode = sentenceLoop.rates ? 'loopRates' : 'loopTimes';
    } else if (shadowing) {
        progressMode = 'shadowing';
    }

    const [nudging, setNudging] = useState(false);
    // 只在「进度模式本身发生变化」时提醒：开启以及三种模式互相切换都算；
    // 仅取消钉住（模式没变）不重复提醒，挂载时也不提醒
    const prevProgressMode = useRef<ProgressMode | null>(progressMode);
    useEffect(() => {
        const modeChanged = prevProgressMode.current !== progressMode;
        prevProgressMode.current = progressMode;
        if (pinned || progressMode === null || !modeChanged) {
            setNudging(false);
            return undefined;
        }
        setNudging(true);
        const timer = window.setTimeout(() => setNudging(false), PIN_NUDGE_DURATION_MS);
        return () => window.clearTimeout(timer);
    }, [pinned, progressMode]);

    return (
        <TooltipProvider delayDuration={300}>
            <Tooltip>
                <TooltipTrigger asChild>
                    <button
                        type="button"
                        onClick={toggle}
                        aria-pressed={pinned}
                        aria-label={pinned ? '取消钉住控制条' : '钉住控制条'}
                        className={cn(
                            'relative w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors',
                            pinned
                                ? 'text-white bg-white/20 hover:bg-white/25'
                                : nudging
                                ? 'text-amber-300 hover:bg-white/15'
                                : cn('text-white/80', DARK_BAR_BUTTON_HOVER)
                        )}
                    >
                        {nudging && (
                            <span
                                aria-hidden
                                className="pointer-events-none absolute inset-0 rounded-lg ring-2 ring-amber-300/60 animate-pulse"
                            />
                        )}
                        <Pin className={cn('w-4 h-4', pinned && 'fill-current')} />
                    </button>
                </TooltipTrigger>
                <TooltipContent side="top" align="end">
                    {pinned ? '取消钉住（恢复自动隐藏）' : '钉住控制条（不再自动隐藏）'}
                </TooltipContent>
            </Tooltip>
        </TooltipProvider>
    );
}
