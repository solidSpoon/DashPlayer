import React, { useEffect, useRef, useState } from 'react';
import { shallow } from 'zustand/shallow';
import { Pause, Play } from 'lucide-react';

import VolumeSlider from '../VolumeSlider';
import SpeedSlider from '../speed-slider';
import { Slider } from '@/fronted/components/ui/slider';
import { Card } from '@/fronted/components/ui/card';
import { Button } from '@/fronted/components/ui/button';
import { cn } from '@/fronted/lib/utils';
import useLayout from '@/fronted/hooks/useLayout';
import TimeUtil from '@/common/utils/TimeUtil';
import { getRendererLogger } from '@/fronted/log/simple-logger';
import { usePlayerV2State } from '@/fronted/hooks/usePlayerV2State';
import { playerV2Actions } from '@/fronted/components/feature/player/player-v2';
import FullscreenButton from '@/fronted/pages/player/components/subtitles/FullscreenButton';

const logger = getRendererLogger('PlayerControlPanel');

export interface PlayerControlPanelProps {
    className?: string;
    onPause?: () => void;
    onPlay?: () => void;
    playing?: boolean;
    onTimeChange?: (time: number) => void;
}

const PlayerControlPanel = ({
    className,
    onTimeChange,
    onPause,
    onPlay,
    playing
}: PlayerControlPanelProps) => {
    const {
        playTime,
        duration,
        volume,
        playbackRate,
        muted
    } = usePlayerV2State(
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
            const timeout = window.setTimeout(() => setMouseOverOut(true), 50);
            mouseOverTimeout.current.push(timeout);
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
            const timeout = window.setTimeout(() => setMouseOverOut(true), 100);
            mouseOverTimeout.current.push(timeout);
        }
    };

    return (
        <div
            onMouseMove={handleMouseMove}
            onMouseLeave={onMouseLeave}
            className={cn(
                'w-full flex flex-col-reverse pt-10 h-full text-white/80 p-3 px-4',
                className
            )}
        >
            <Card
                className={cn(
                    'p-5 pb-3',
                    mouseOverOut && 'backdrop-blur bg-background/50',
                    !mouseOverOut && 'backdrop-blur-0 bg-transparent h-20 border-0 shadow-none'
                )}
                onMouseMove={(e) => {
                    e.stopPropagation();
                    handleMouseMoveIn();
                }}
            >
                <div className={cn('flex flex-col items-center justify-between w-full gap-4')}>
                    {mouseOverOut && (
                        <>
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
                                    playerV2Actions.setAutoPause(false);
                                    playerV2Actions.setSingleRepeat(false);
                                }}
                                onValueCommit={(value) => {
                                    currentValueUpdateTime.current = Date.now();
                                    setSelecting(false);
                                }}
                            />
                            <div className="w-full flex justify-between items-center">
                                <div className="flex gap-4 items-center">
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
                                        className="w-9 h-9"
                                    >
                                        {playing ? <Pause /> : <Play />}
                                    </Button>
                                    <div className="h-full flex items-center font-mono">
                                        {`${TimeUtil.secondToTimeStr(currentValue)} / ${TimeUtil.secondToTimeStr(duration)}`}
                                    </div>
                                </div>
                                <div className="h-full flex-1" />
                                <div className="flex justify-center items-end gap-4">
                                    <SpeedSlider
                                        speed={playbackRate}
                                        onSpeedChange={(speed) => playerV2Actions.setPlaybackRate(speed)}
                                    />
                                    <VolumeSlider
                                        muted={muted}
                                        onMutedChange={(nextMuted) => playerV2Actions.setMuted(nextMuted)}
                                        volume={volume}
                                        onVolumeChange={(nextVolume) => playerV2Actions.setVolume(nextVolume)}
                                    />
                                    <FullscreenButton fullScreen={fullScreen} changeFullScreen={changeFullScreen} />
                                </div>
                            </div>
                        </>
                    )}
                </div>
            </Card>
        </div>
    );
};

PlayerControlPanel.defaultProps = {
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

export default PlayerControlPanel;
