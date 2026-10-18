import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { shallow } from 'zustand/shallow';

import VolumeSlider from '../VolumeSlider';
import SpeedSlider from '../SpeedSlider';
import { Slider } from '@/fronted/components/ui/slider';
import { cn } from '@/fronted/lib/utils';
import useLayout from '@/fronted/hooks/useLayout';
import TimeUtil from '@/common/utils/TimeUtil';
import { getRendererLogger } from '@/fronted/log/simple-logger';
import { usePlayerState } from '@/fronted/features/player/playerState';
import { usePlayerUi } from '@/fronted/features/player/playerUiStore';
import { playerActions } from '@/fronted/features/player/components/PlayerActions';
import FullscreenToggleButton from '@/fronted/features/player/components/subtitles/FullscreenToggleButton';
import ControlBarPinButton from '@/fronted/features/player/components/subtitles/ControlBarPinButton';
import {
    DARK_BAR_BUTTON_HOVER,
    PlaybackModeControls,
    PlaybackNavControls
} from '@/fronted/features/player/components/PlaybackGlobalControls';
import { CONTROL_POPOVER_OFFSET_STACKED_BAR } from '@/fronted/features/player/components/ControlPopover';
import { CONTROL_BAR_ZONE_PX, measureControlBarPanelMetrics } from '@/fronted/features/player/components/controlBarZone';

const logger = getRendererLogger('PlaybackControlBar');


export interface PlaybackControlBarProps {
    className?: string;
    onTimeChange?: (time: number) => void;
}

const PlaybackControlBar = ({
    className,
    onTimeChange
}: PlaybackControlBarProps) => {
    const {
        playTime,
        duration,
        volume,
        playbackRate,
        muted
    } = usePlayerState(
        (state) => ({
            playTime: state.internal.exactPlayTime,
            duration: state.duration,
            volume: state.volume,
            playbackRate: state.playbackRate,
            muted: state.muted
        }),
        shallow
    );

    const fullScreen = useLayout((s) => s.fullScreen);
    const changeFullScreen = useLayout((s) => s.changeFullScreen);
    // 用户钉住后控制条常显，不再受鼠标超时隐藏影响
    const pinned = usePlayerUi((s) => s.controlBarPinned);
    // 鼠标压在遮挡贴片上时让位：贴片与这条控制条都是悬停才现身的浮层，压在同一块区域会互相抢事件
    const maskHovering = usePlayerUi((s) => s.hardsubMaskHovering);
    const maskOn = usePlayerUi((s) => s.hardsubMaskOn);
    const patchTopInset = usePlayerUi((s) => s.hardsubMaskPatchTopInset);
    const patchBottomInset = usePlayerUi((s) => s.hardsubMaskPatchBottomInset);
    const stageHeight = usePlayerUi((s) => s.hardsubMaskStageHeight);
    // 只有贴片压进控制条地盘（底部 152px ≈ 感应区 144 + 间距）时才让位；
    // 贴片挪到画面中上部、底部空出来时，控制条就待在原位
    const maskOccupiesBarZone = maskOn && patchBottomInset < CONTROL_BAR_ZONE_PX;
    const setControlBarPanelZone = usePlayerUi((s) => s.setControlBarPanelZone);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    // 抬起量：让整条控制条落在贴片上沿之上；上限保证它不会被顶出画面（条高约 144 + 余量）
    const maxLift = Math.max(0, stageHeight - 200);
    const liftPx = maskOccupiesBarZone ? Math.min(maxLift, Math.max(0, patchTopInset)) : 0;

    const [mouseOverOut, setMouseOverOut] = useState<boolean>(false);
    // 训练模式/字幕轨道菜单或训练参数弹窗展开期间钉住控制条：鼠标移向菜单会先离开本条区域
    const [menuOpen, setMenuOpen] = useState<boolean>(false);
    const [currentValue, setCurrentValue] = useState(0);
    const currentValueUpdateTime = useRef<number>(0);
    const [selecting, setSelecting] = useState(false);
    const mouseOverTimeout = useRef<number[]>([0]);

    useEffect(() => {
        if (selecting || Date.now() - currentValueUpdateTime.current < 500) {
            return;
        }
        setCurrentValue(playTime);
    }, [playTime, duration, selecting]);

    const onMouseLeave = () => {
        while (mouseOverTimeout.current.length > 0) {
            window.clearTimeout(mouseOverTimeout.current.pop());
        }
        setMouseOverOut(false);
    };

    const handleMouseMove = () => {
        while (mouseOverTimeout.current.length > 0) {
            window.clearTimeout(mouseOverTimeout.current.pop());
        }
        if (!mouseOverOut) {
            setMouseOverOut(true);
        }
        const timeout = window.setTimeout(() => {
            setMouseOverOut(false);
        }, 2000);
        mouseOverTimeout.current.push(timeout);
    };

    const handleMouseMoveIn = () => {
        while (mouseOverTimeout.current.length > 0) {
            window.clearTimeout(mouseOverTimeout.current.pop());
        }
        if (!mouseOverOut) {
            setMouseOverOut(true);
        }
    };

    // 把面板的实际位置播报出去：拖动贴片时按这块真实矩形画框，抬到哪就画到哪
    useLayoutEffect(() => {
        const wrapper = wrapperRef.current;
        const panel = panelRef.current;
        if (!wrapper || !panel) {
            return;
        }
        const metrics = measureControlBarPanelMetrics(panel, wrapper);
        if (!metrics) {
            return;
        }
        // 面板绝对位置 = 基础间距 + 当前抬升量 + 面板相对外层底边的固定偏移
        setControlBarPanelZone({
            bottom: Math.round(liftPx + 8 + metrics.fromWrapperBottom),
            height: metrics.height,
            left: metrics.left,
            right: metrics.right,
        });
    }, [liftPx, setControlBarPanelZone]);
    useEffect(() => () => setControlBarPanelZone(null), [setControlBarPanelZone]);

    return (
        <div
            ref={wrapperRef}
            onMouseMove={handleMouseMove}
            onMouseLeave={onMouseLeave}
            style={{ bottom: liftPx + 8 }}
            className={cn(
                'w-full flex flex-col-reverse h-36 text-white/90 px-4 pb-8 pt-2 pointer-events-auto',
                'transition-[bottom] duration-200 ease-out',
                className
            )}
        >
            <div
                ref={panelRef}
                className={cn(
                    'relative z-20 w-full px-4 py-3 rounded-2xl border border-white/10 bg-black/60 backdrop-blur-md shadow-2xl transition-opacity duration-200 ease-out pointer-events-auto',
                    (mouseOverOut || menuOpen || pinned) && !(maskHovering && maskOccupiesBarZone && !pinned)
                        ? 'opacity-100'
                        : 'opacity-0 pointer-events-none'
                )}
                onMouseMove={(e) => {
                    e.stopPropagation();
                    handleMouseMoveIn();
                }}
            >
                <div className="flex flex-col items-center justify-between w-full gap-2.5">
                    <Slider
                        max={Math.max(duration, 0.1)}
                        min={0}
                        step={0.1}
                        disabled={duration <= 0}
                        value={[Math.min(Math.max(0, currentValue), Math.max(duration, 0.1))]}
                        onValueChange={(value) => {
                            const [next] = value;
                            logger.debug('time slider changing', { next });
                            setCurrentValue(next);
                            setSelecting(true);
                        }}
                        onValueCommit={(value) => {
                            const [next] = value;
                            currentValueUpdateTime.current = Date.now();
                            setCurrentValue(next);
                            onTimeChange?.(next);
                            playerActions.setAutoPause(false);
                            playerActions.setSingleRepeat(false);
                            setSelecting(false);
                        }}
                    />
                    <div className="w-full flex justify-between items-center">
                        <div className="flex gap-2 items-center">
                            {/* 上一句 / 播放暂停 / 下一句：与全屏控制条共用同一份控件 */}
                            <PlaybackNavControls />
                            <div className="h-full flex items-center font-mono text-xs text-white/80 tabular-nums">
                                <span>{TimeUtil.secondToTimeStr(currentValue)}</span>
                                <span className="mx-1.5 text-white/40">/</span>
                                <span className="text-white/60">{TimeUtil.secondToTimeStr(duration)}</span>
                            </div>
                        </div>
                        <div className="h-full flex-1" />
                        <div className="flex justify-center items-center gap-2">
                            {/* 训练模式 / 字幕轨道：与全屏控制条共用同一份控件 */}
                            <PlaybackModeControls
                                popoverOffset={CONTROL_POPOVER_OFFSET_STACKED_BAR}
                                onMenuOpenChange={setMenuOpen}
                            />
                            <SpeedSlider
                                speed={playbackRate}
                                popoverOffset={CONTROL_POPOVER_OFFSET_STACKED_BAR}
                                triggerClassName={DARK_BAR_BUTTON_HOVER}
                                onSpeedChange={(speed) => playerActions.setPlaybackRate(speed)}
                            />
                            <VolumeSlider
                                muted={muted}
                                onMutedChange={(nextMuted) => playerActions.setMuted(nextMuted)}
                                volume={volume}
                                onVolumeChange={(nextVolume) => playerActions.setVolume(nextVolume)}
                                triggerClassName={DARK_BAR_BUTTON_HOVER}
                            />
                            <ControlBarPinButton />
                            <FullscreenToggleButton fullScreen={fullScreen} changeFullScreen={changeFullScreen} />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

PlaybackControlBar.defaultProps = {
    className: '',
    onTimeChange: () => {
        //
    }
};

export default PlaybackControlBar;
