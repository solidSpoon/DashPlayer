import React, { useEffect, useRef, useState } from 'react';
import { FaPause, FaPlay } from 'react-icons/fa';
import { useShallow } from 'zustand/react/shallow';
import VolumeSlider from '../VolumeSlider';
import usePlayerController from '../../hooks/usePlayerController';
import { cn, secondToDate } from '@/common/utils/Util';
import SpeedSlider from '../speed-slider';
import { Slider } from '@/fronted/components/ui/slider';
import { Card } from '@/fronted/components/ui/card';
import useLayout from '@/fronted/hooks/useLayout';
import FullscreenButton from '@/fronted/components/playerSubtitle/FullscreenButton';
import {Pause, Play} from "lucide-react";
import {Button} from "@/fronted/components/ui/button";

export interface PlayerControlPannelProps {
    className?: string;

}

const ViewerControlPannel = ({
                                 className
                             }: PlayerControlPannelProps) => {
    const {
        playTime,
        duration,
        volume,
        setVolume,
        playbackRate,
        setPlaybackRate,
        muted,
        setMuted,
        onPlay,
        onPause,
        playing,
        onTimeChange
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
            onPlay: s.play,
            onPause: s.pause,
            playing: s.playing,
            onTimeChange: s.seekTo
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


    return (
        <div className={cn(' h-32 flex w-full flex-col justify-end', className)}>

            <Card
                className={cn('w-full p-4 pt-6 backdrop-blur bg-background/50 rounded-none border-0 border-t shadow-2xl',
                    !mouseOver && 'bg-transparent border-none backdrop-blur-0 shadow-none'
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
                        'flex flex-col items-center justify-between w-full gap-4',
                        !mouseOver && 'invisible'
                    )}
                >

                    <Slider
                        className=""
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
                            onTimeChange?.({time: value[0]});
                            setSelecting(false);
                        }}
                    />
                    <div className="w-full flex justify-between items-center">
                        <div className="flex gap-4">
                            <Button
                                onClick={() => {
                                    if (playing) {
                                        onPause?.();
                                    } else {
                                        onPlay?.();
                                    }
                                }}
                                size={'icon'}
                                variant={'ghost'}
                                // className="flex justify-center items-center rounded-lg"
                            >
                                {playing ? (
                                    <Pause className="" />
                                ) : (
                                    <Play className="" />
                                )}
                            </Button>
                            <div className=" h-full flex items-center">
                                {`${secondToDate(
                                    currentValue
                                )} / ${secondToDate(duration)}`}
                            </div>
                        </div>
                        <div className="h-full flex-1" />
                        <div className="flex justify-center items-end gap-4">
                            {/* <FullscreenButton fullScreen={fullScreen} changeFullScreen={changeFullScreen} /> */}
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
                        </div>
                    </div>

                </div>
            </Card>
        </div>

    );
};
ViewerControlPannel.defaultProps = {
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

export default ViewerControlPannel;
