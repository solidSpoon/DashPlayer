import React, { useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import VolumeSlider from '../VolumeSlider';
import usePlayerController from '../../hooks/usePlayerController';
import {cn} from "@/fronted/lib/utils";
import SpeedSlider from '../speed-slider';
import { Slider } from '@/fronted/components/ui/slider';
import { Card } from '@/fronted/components/ui/card';
import useLayout from '@/fronted/hooks/useLayout';
import FullscreenButton from '@/fronted/components/playerSubtitle/FullscreenButton';
import {Pause, Play} from "lucide-react";
import { Button } from '@/fronted/components/ui/button';
import TimeUtil from "@/common/utils/TimeUtil";

export interface PlayerControlPannelProps {
    className?: string;
    onPause?: () => void;
    onPlay?: () => void;
    playing?: boolean;
    onTimeChange?: (time: number) => void;
}

const PlayerControlPannel = ({
                                 className,
                                 onTimeChange,
                                 onPause,
                                 onPlay,
                                 playing
                             }: PlayerControlPannelProps) => {
    const {
        playTime,
        duration,
        volume,
        setVolume,
        playbackRate,
        setPlaybackRate,
        muted,
        setMuted
    } = usePlayerController(
        useShallow((s) => ({
            playTime: s.playTime,
            duration: s.duration,
            volume: s.volume,
            setVolume: s.setVolume,
            playbackRate: s.playbackRate,
            setPlaybackRate: s.setPlaybackRate,
            setMuted: s.setMuted,
            muted: s.muted
        }))
    );
    const [mouseOver, setMouseOver] = useState<boolean>(false);
    const [currentValue, setCurrentValue] = useState(0);
    const currentValueUpdateTime = useRef<number>(0);
    const [selecting, setSelecting] = useState(false);

    // const currentValueUpdateTime
    useEffect(() => {
        if (selecting || Date.now() - currentValueUpdateTime.current < 500) {
            return;
        }
        setCurrentValue(playTime);
    }, [playTime, duration, selecting]);
    const fullScreen = useLayout(s => s.fullScreen);
    const changeFullScreen = useLayout(s => s.changeFullScreen);


    return (
        <div className=' h-16 flex w-full flex-col justify-end'>
            <Card
                className={cn('w-full p-2 backdrop-blur bg-background/50 rounded-none border-0 border-t',
                    !mouseOver && 'bg-transparent border-none backdrop-blur-0'
                )}
                onMouseOver={(e) => {
                    setMouseOver(true);
                }}
                onMouseLeave={() => {
                    setMouseOver(false);
                }}
            >
                <div
                    className={cn(
                        'flex items-center w-full gap-4',
                        !mouseOver && 'invisible'
                    )}
                >


                    <div className='flex gap-4 items-center'>
                        <Button
                            onClick={() => {
                                if (playing) {
                                    onPause?.();
                                } else {
                                    onPlay?.();
                                }
                            }}
                            size='icon'
                            variant='ghost'
                            className='w-9 h-9'
                        >
                            {playing ? (
                                <Pause />
                            ) : (
                                <Play />
                            )}
                        </Button>
                        <div className=' h-full flex items-center w-40'>
                            {`${TimeUtil.secondToTimeStr(
                                currentValue
                            )} / ${TimeUtil.secondToTimeStr(duration)}`}
                        </div>
                    </div>
                    <Slider
                        className='flex-1'
                        max={duration}
                        min={0}
                        value={[currentValue]}
                        onValueChange={(value) => {
                            console.log('onValueChange', value);
                            setCurrentValue(value[0]);
                            setSelecting(true);
                            onPause?.();
                        }}
                        onValueCommit={(value) => {
                            currentValueUpdateTime.current = Date.now();
                            onTimeChange?.(value[0]);
                            setSelecting(false);
                        }}
                    />
                    <div className='flex justify-center items-end gap-4'>
                        <SpeedSlider
                            speed={playbackRate}
                            onSpeedChange={setPlaybackRate}
                            onSelectFinish={() => {
                                setMouseOver(false);
                            }}
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
            </Card>
        </div>

    );
};
PlayerControlPannel.defaultProps = {
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

export default PlayerControlPannel;
