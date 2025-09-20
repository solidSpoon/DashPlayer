import React, { useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import VolumeSlider from '../VolumeSlider';
import usePlayerController from '../../../hooks/usePlayerController';
import { cn } from '@/fronted/lib/utils';
import SpeedSlider from '../speed-slider';
import { Slider } from '@/fronted/components/ui/slider';
import { Card } from '@/fronted/components/ui/card';
import useLayout from '@/fronted/hooks/useLayout';
import FullscreenButton from '@/fronted/pages/player/playerSubtitle/FullscreenButton';
import { Pause, Play } from 'lucide-react';
import { Button } from '@/fronted/components/ui/button';
import TimeUtil from '@/common/utils/TimeUtil';
import { getRendererLogger } from '@/fronted/log/simple-logger';

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
        setVolume,
        playbackRate,
        setPlaybackRate,
        muted,
        setMuted,
        changeSingleRepeat,
        changeAutoPause
    } = usePlayerController(
        useShallow((s) => ({
            playTime: s.playTime,
            duration: s.duration,
            volume: s.volume,
            setVolume: s.setVolume,
            playbackRate: s.playbackRate,
            setPlaybackRate: s.setPlaybackRate,
            setMuted: s.setMuted,
            muted: s.muted,
            singleRepeat: s.singleRepeat,
            autoPause: s.autoPause,
            changeSingleRepeat: s.changeSingleRepeat,
            changeAutoPause: s.changeAutoPause
        }))
    );
    const fullScreen = useLayout(s => s.fullScreen);
    const changeFullScreen = useLayout(s => s.changeFullScreen);
    const [mouseOverOut, setMouseOverOut] = useState<boolean>(false);
    const [currentValue, setCurrentValue] = useState(0);
    const currentValueUpdateTime = useRef<number>(0);
    const [selecting, setSelecting] = useState(false);
    const mouseOverTimeout = useRef<number[]>([0]);
    // const currentValueUpdateTime
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

    const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
        while (mouseOverTimeout.current.length > 0) {
            window.clearTimeout(mouseOverTimeout.current.pop());
        }
        if (!mouseOverOut) {
            const timeout = window.setTimeout(() => setMouseOverOut(true), 50);
            if (mouseOverTimeout.current.push) {
                mouseOverTimeout.current.push(timeout);
            } else {
                mouseOverTimeout.current = [timeout];
            }
        }
        const timeout = window.setTimeout(() => {
            setMouseOverOut(false);
        }, 2000);
        if (mouseOverTimeout.current.push) {
            mouseOverTimeout.current.push(timeout);
        } else {
            mouseOverTimeout.current = [timeout];
        }
    };

    const handleMouseMoveIn = () => {
        while (mouseOverTimeout.current.length > 0) {
            window.clearTimeout(mouseOverTimeout.current.pop());
        }
        if (!mouseOverOut) {
            const timeout = window.setTimeout(() => setMouseOverOut(true), 100);
            if (mouseOverTimeout.current.push) {
                mouseOverTimeout.current.push(timeout);
            } else {
                mouseOverTimeout.current = [timeout];
            }
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
                className={cn('p-5 pb-3',
                    mouseOverOut && 'backdrop-blur bg-background/50',
                    !mouseOverOut && 'backdrop-blur-0 bg-transparent h-20 border-0 shadow-none')}
                onMouseMove={(e) => {
                    e.stopPropagation();
                    handleMouseMoveIn();
                }}
                onMouseLeave={() => {
                    //
                }}
            >
                <div
                    className={cn(
                        'flex flex-col items-center justify-between w-full gap-4'
                        // !mouseOverOut && 'invisible'
                    )}
                >
                    {mouseOverOut && (<>
                        <Slider
                            className=""
                            max={duration}
                            min={0}
                            value={[currentValue]}
                            onValueChange={(value) => {
                                logger.debug('playback rate changed', { value });
                                setCurrentValue(value[0]);
                                setSelecting(true);
                                onTimeChange?.(value[0]);
                                changeAutoPause(false);
                                changeSingleRepeat(false);
                                // onPause?.();
                            }}
                            onValueCommit={(value) => {
                                currentValueUpdateTime.current = Date.now();
                                // onTimeChange?.(value[0]);
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
                                    {playing ? (
                                        <Pause />
                                    ) : (
                                        <Play />
                                    )}
                                </Button>
                                <div className=" h-full flex items-center font-mono">
                                    {`${TimeUtil.secondToTimeStr(
                                        currentValue
                                    )} / ${TimeUtil.secondToTimeStr(duration)}`}
                                </div>
                            </div>
                            <div className="h-full flex-1" />
                            <div className="flex justify-center items-end gap-4">
                                <SpeedSlider
                                    speed={playbackRate}
                                    onSpeedChange={setPlaybackRate}
                                />
                                <VolumeSlider
                                    muted={muted}
                                    onMutedChange={setMuted}
                                    volume={volume}
                                    onVolumeChange={setVolume}
                                />
                                <FullscreenButton fullScreen={fullScreen} changeFullScreen={changeFullScreen} />
                            </div>
                        </div>
                    </>)}
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
