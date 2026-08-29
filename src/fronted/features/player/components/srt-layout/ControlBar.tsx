import React, { useEffect, useRef, useState } from 'react';
import { shallow } from 'zustand/shallow';
import { Pause, Play } from 'lucide-react';

import VolumeSlider from '../VolumeSlider';
import SpeedSlider from '../SpeedSlider';
import { Slider } from '@/fronted/components/ui/slider';
import { Card } from '@/fronted/components/ui/card';
import { Button } from '@/fronted/components/ui/button';
import { cn } from '@/fronted/lib/utils';
import useLayout from '@/fronted/hooks/useLayout';
import TimeUtil from '@/common/utils/TimeUtil';
import { getRendererLogger } from '@/fronted/log/simple-logger';
import { usePlayerState } from '@/fronted/features/player/playerState';
import { playerActions } from '@/fronted/features/player/components/PlayerActions';
import FullscreenToggleButton from '@/fronted/features/player/components/subtitles/FullscreenToggleButton';

const logger = getRendererLogger('PlaybackControlBar');

export interface PlaybackControlBarProps {
    className?: string;
    onPause?: () => void;
    onPlay?: () => void;
    playing?: boolean;
    onTimeChange?: (time: number) => void;
}

const PlaybackControlBar = ({
    className,
    onTimeChange,
    onPause,
    onPlay,
    playing
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

    const [mouseOverOut, setMouseOverOut] = useState<boolean>(false);
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

    return (
        <div
            onMouseMove={handleMouseMove}
            onMouseLeave={onMouseLeave}
            className={cn(
                'w-full flex flex-col-reverse h-36 text-white/90 px-4 pb-8 pt-2 pointer-events-auto',
                className
            )}
        >
            <div
                className={cn(
                    'w-full px-4 py-3 rounded-2xl border border-white/10 bg-black/60 backdrop-blur-md shadow-2xl transition-opacity duration-200 ease-out pointer-events-auto',
                    mouseOverOut ? 'opacity-100' : 'opacity-0 pointer-events-none'
                )}
                onMouseMove={(e) => {
                    e.stopPropagation();
                    handleMouseMoveIn();
                }}
            >
                <div className="flex flex-col items-center justify-between w-full gap-2.5">
                    <Slider
                        max={duration}
                        min={0}
                        value={[currentValue]}
                        onValueChange={(value) => {
                            const [next] = value;
                            logger.debug('time slider changing', { next });
                            setCurrentValue(next);
                            setSelecting(true);
                            onTimeChange?.(next);
                            playerActions.setAutoPause(false);
                            playerActions.setSingleRepeat(false);
                        }}
                        onValueCommit={() => {
                            currentValueUpdateTime.current = Date.now();
                            setSelecting(false);
                        }}
                    />
                    <div className="w-full flex justify-between items-center">
                        <div className="flex gap-2 items-center">
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
                            <div className="h-full flex items-center font-mono text-xs text-white/80 tabular-nums">
                                <span>{TimeUtil.secondToTimeStr(currentValue)}</span>
                                <span className="mx-1.5 text-white/40">/</span>
                                <span className="text-white/60">{TimeUtil.secondToTimeStr(duration)}</span>
                            </div>
                        </div>
                        <div className="h-full flex-1" />
                        <div className="flex justify-center items-center gap-2">
                            <SpeedSlider
                                speed={playbackRate}
                                onSpeedChange={(speed) => playerActions.setPlaybackRate(speed)}
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
        </div>
    );
};

PlaybackControlBar.defaultProps = {
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

export default PlaybackControlBar;
