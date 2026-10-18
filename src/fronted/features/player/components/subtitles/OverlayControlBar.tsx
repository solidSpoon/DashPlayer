import React, { useEffect, useRef, useState } from 'react';
import { shallow } from 'zustand/shallow';

import VolumeSlider from '../VolumeSlider';
import SpeedSlider from '../SpeedSlider';
import { Slider } from '@/fronted/components/ui/slider';
import useLayout from '@/fronted/hooks/useLayout';
import FullscreenToggleButton from './FullscreenToggleButton';
import ControlBarPinButton from './ControlBarPinButton';
import TimeUtil from '@/common/utils/TimeUtil';
import { getRendererLogger } from '@/fronted/log/simple-logger';
import { cn } from '@/fronted/lib/utils';
import { usePlayerState } from '@/fronted/features/player/playerState';
import { usePlayerUi } from '@/fronted/features/player/playerUiStore';
import { playerActions } from '@/fronted/features/player/components/PlayerActions';
import {
    DARK_BAR_BUTTON_HOVER,
    PlaybackModeControls,
    PlaybackNavControls
} from '@/fronted/features/player/components/PlaybackGlobalControls';
import { CONTROL_POPOVER_OFFSET_SINGLE_ROW_BAR } from '@/fronted/features/player/components/ControlPopover';

export interface OverlayControlBarProps {
    className?: string;
    onTimeChange?: (time: number) => void;
}

/** 全屏控制条的感应区高度（h-32 + 内边距）：贴片压进这块区域时才让位。 */
const OVERLAY_BAR_ZONE_PX = 132;

const OverlayControlBar = ({
    className,
    onTimeChange
}: OverlayControlBarProps) => {
    const logger = getRendererLogger('OverlayControlBar');
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

    const [mouseOver, setMouseOver] = useState<boolean>(false);
    // 训练模式/字幕轨道菜单或训练参数弹窗展开期间钉住控制条：鼠标移向菜单会先离开本条区域
    const [menuOpen, setMenuOpen] = useState<boolean>(false);
    const [currentValue, setCurrentValue] = useState(0);
    const currentValueUpdateTime = useRef<number>(0);
    const [selecting, setSelecting] = useState(false);

    useEffect(() => {
        if (selecting || Date.now() - currentValueUpdateTime.current < 500) {
            return;
        }
        setCurrentValue(playTime);
    }, [playTime, duration, selecting]);

    const fullScreen = useLayout((s) => s.fullScreen);
    const changeFullScreen = useLayout((s) => s.changeFullScreen);
    // 用户钉住后控制条常显，不再受鼠标移出隐藏影响（与普通视图条共用同一开关）
    const pinned = usePlayerUi((s) => s.controlBarPinned);
    // 与普通视图条一致：鼠标压在遮挡贴片上时让位，并抬到贴片之上
    const maskHovering = usePlayerUi((s) => s.hardsubMaskHovering);
    const maskOn = usePlayerUi((s) => s.hardsubMaskOn);
    const patchTopInset = usePlayerUi((s) => s.hardsubMaskPatchTopInset);
    const patchBottomInset = usePlayerUi((s) => s.hardsubMaskPatchBottomInset);
    const stageHeight = usePlayerUi((s) => s.hardsubMaskStageHeight);
    // 与普通视图条同一套判断：贴片没压进这条的感应区时，就待在原位
    const maskOccupiesBarZone = maskOn && patchBottomInset < OVERLAY_BAR_ZONE_PX;
    const maxLift = Math.max(0, stageHeight - 180);
    const liftPx = maskOccupiesBarZone ? Math.min(maxLift, Math.max(0, patchTopInset)) : 0;

    return (
        <div
            onMouseOver={() => {
                setMouseOver(true);
            }}
            onMouseLeave={() => {
                setMouseOver(false);
            }}
            style={{ marginBottom: liftPx }}
            className={cn('w-full flex flex-col justify-end h-32 p-4 pointer-events-auto transition-[margin] duration-200 ease-out')}
        >
            <div
                className={cn(
                    'w-full px-4 py-2.5 rounded-2xl border border-white/10 bg-black/65 backdrop-blur-md shadow-2xl transition-opacity duration-200 ease-out pointer-events-auto',
                    (mouseOver || menuOpen || pinned) && !(maskHovering && maskOccupiesBarZone && !pinned)
                        ? 'opacity-100'
                        : 'opacity-0 pointer-events-none',
                    className
                )}
            >
                <div className="flex items-center w-full gap-3 text-white/90">
                    <div className="flex gap-2 items-center shrink-0">
                        {/* 上一句 / 播放暂停 / 下一句：与普通控制条共用同一份控件 */}
                        <PlaybackNavControls />
                        <div className="h-full flex items-center font-mono text-xs text-white/80 tabular-nums shrink-0">
                            <span>{TimeUtil.secondToTimeStr(currentValue)}</span>
                            <span className="mx-1 text-white/40">/</span>
                            <span className="text-white/60">{TimeUtil.secondToTimeStr(duration)}</span>
                        </div>
                    </div>
                    <div className="flex-1 px-2 flex items-center">
                        <Slider
                            className="w-full"
                            max={Math.max(duration, 0.1)}
                            min={0}
                            step={0.1}
                            disabled={duration <= 0}
                            value={[Math.min(Math.max(0, currentValue), Math.max(duration, 0.1))]}
                            onValueChange={(value) => {
                                const [next] = value;
                                logger.debug('Time slider value changed', { value: next });
                                setCurrentValue(next);
                                setSelecting(true);
                                playerActions.pause();
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
                    </div>
                    <div className="flex justify-center items-center gap-2 shrink-0">
                        {/* 训练模式 / 字幕轨道：与普通控制条共用同一份控件 */}
                        <PlaybackModeControls
                            popoverOffset={CONTROL_POPOVER_OFFSET_SINGLE_ROW_BAR}
                            onMenuOpenChange={setMenuOpen}
                        />
                        <SpeedSlider
                            speed={playbackRate}
                            popoverOffset={CONTROL_POPOVER_OFFSET_SINGLE_ROW_BAR}
                            triggerClassName={DARK_BAR_BUTTON_HOVER}
                            onSpeedChange={(speed) => playerActions.setPlaybackRate(speed)}
                            onSelectFinish={() => {
                                setMouseOver(false);
                            }}
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
    );
};

OverlayControlBar.defaultProps = {
    className: '',
    onTimeChange: () => {
        //
    }
};

export default OverlayControlBar;
