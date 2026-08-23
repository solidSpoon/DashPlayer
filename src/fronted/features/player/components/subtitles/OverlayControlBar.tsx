import React, { useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { shallow } from 'zustand/shallow';

import VolumeSlider from '../VolumeSlider';
import SpeedSlider from '../SpeedSlider';
import { Slider } from '@/fronted/components/ui/slider';
import { Card } from '@/fronted/components/ui/card';
import useLayout from '@/fronted/hooks/useLayout';
import FullscreenToggleButton from './FullscreenToggleButton';
import { Button } from '@/fronted/components/ui/button';
import TimeUtil from '@/common/utils/TimeUtil';
import { getRendererLogger } from '@/fronted/log/simple-logger';
import { cn } from '@/fronted/lib/utils';
import { usePlayerState } from '@/fronted/features/player/playerState';
import { playerActions } from '@/fronted/features/player/components/PlayerActions';

export interface OverlayControlBarProps {
    className?: string;
    onPause?: () => void;
    onPlay?: () => void;
    playing?: boolean;
    onTimeChange?: (time: number) => void;
}

const OverlayControlBar = ({
    className,
    onTimeChange,
    onPause,
    onPlay,
    playing
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

    return (
        <div
            onMouseOver={() => {
                setMouseOver(true);
            }}
            onMouseLeave={() => {
                setMouseOver(false);
            }}
            className="w-full flex flex-col justify-end h-32 p-4 pointer-events-auto"
        >
            <div
                className={cn(
                    'w-full px-4 py-2.5 rounded-2xl border border-white/10 bg-black/65 backdrop-blur-md shadow-2xl transition-all duration-150 ease-out pointer-events-auto',
                    mouseOver ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-1 pointer-events-none',
                    className
                )}
            >
                <div className="flex items-center w-full gap-3 text-white/90">
                    <div className="flex gap-2 items-center shrink-0">
                        <Button
                            onClick={() => {
                                if (playing) {
                                    onPause?.();
                                } else {
                                    onPlay?.();
                                }
                            }}
                            size="icon"
                            variant="ghost"
                            className="w-8 h-8 rounded-lg text-white/90 hover:text-white hover:bg-white/15 transition-colors"
                        >
                            {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4 ml-0.5" />}
                        </Button>
                        <div className="h-full flex items-center font-mono text-xs text-white/80 tabular-nums shrink-0">
                            <span>{TimeUtil.secondToTimeStr(currentValue)}</span>
                            <span className="mx-1 text-white/40">/</span>
                            <span className="text-white/60">{TimeUtil.secondToTimeStr(duration)}</span>
                        </div>
                    </div>
                    <div className="flex-1 px-2 flex items-center">
                        <Slider
                            className="w-full"
                            max={duration}
                            min={0}
                            value={[currentValue]}
                            onValueChange={(value) => {
                                const [next] = value;
                                logger.debug('Time slider value changed', { value: next });
                                setCurrentValue(next);
                                setSelecting(true);
                                onPause?.();
                            }}
                            onValueCommit={(value) => {
                                const [next] = value;
                                currentValueUpdateTime.current = Date.now();
                                onTimeChange?.(next);
                                playerActions.setAutoPause(false);
                                playerActions.setSingleRepeat(false);
                                setSelecting(false);
                            }}
                        />
                    </div>
                    <div className="flex justify-center items-center gap-2 shrink-0">
                        <SpeedSlider
                            speed={playbackRate}
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
                        />
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
    },
    onPause: () => {
        //
    },
    onPlay: () => {
        //
    },
    playing: false
};

export default OverlayControlBar;
