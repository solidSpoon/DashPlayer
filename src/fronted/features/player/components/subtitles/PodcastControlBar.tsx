import React, { useEffect, useRef, useState } from 'react';
import VolumeSlider from '../VolumeSlider';
import { usePlayer } from '@/fronted/features/player/playerStore';
import {cn} from "@/fronted/lib/utils";
import SpeedSlider from '../SpeedSlider';
import { Slider } from '@/fronted/components/ui/slider';
import { Card } from '@/fronted/components/ui/card';
import {Pause, Play} from "lucide-react";
import {Button} from "@/fronted/components/ui/button";
import TimeUtil from "@/common/utils/TimeUtil";
import { getRendererLogger } from '@/fronted/log/simple-logger';

export interface PodcastControlBarProps {
    className?: string;

}

const PodcastControlBar = ({
                                 className
                             }: PodcastControlBarProps) => {
    const logger = getRendererLogger('PodcastControlBar');
    const playTime = usePlayer((s) => s.internal.exactPlayTime);
    const duration = usePlayer((s) => s.duration);
    const volume = usePlayer((s) => s.volume);
    const setVolume = usePlayer((s) => s.setVolume);
    const playbackRate = usePlayer((s) => s.playbackRate);
    const setPlaybackRate = usePlayer((s) => s.setPlaybackRate);
    const muted = usePlayer((s) => s.muted);
    const setMuted = usePlayer((s) => s.setMuted);
    const onPlay = usePlayer((s) => s.play);
    const onPause = usePlayer((s) => s.pause);
    const playing = usePlayer((s) => s.playing);
    const seekTo = usePlayer((s) => s.seekTo);
    const setAutoPause = usePlayer((s) => s.setAutoPause);
    const setSingleRepeat = usePlayer((s) => s.setSingleRepeat);
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
        <div className={cn('w-full pointer-events-auto transition-colors duration-300 pb-5 pt-2 px-8', className)}>
            <div className="w-full flex flex-col gap-3">
                {/* 细致平滑的进度条 */}
                <div className="w-full flex items-center">
                    <Slider
                        className="cursor-pointer py-1"
                        trackClassName="bg-zinc-200/70 dark:bg-zinc-800/80"
                        rangeClassName="bg-zinc-400 dark:bg-zinc-500"
                        thumbClassName="border-zinc-400 dark:border-zinc-500 bg-white dark:bg-zinc-900 shadow-sm"
                        max={duration}
                        min={0}
                        value={[currentValue]}
                        onValueChange={(value) => {
                            logger.debug('Viewer time slider value changed', { value });
                            setCurrentValue(value[0]);
                            setSelecting(true);
                            seekTo({ time: value[0] });
                            setAutoPause(false);
                            setSingleRepeat(false);
                        }}
                        onValueCommit={() => {
                            currentValueUpdateTime.current = Date.now();
                            setSelecting(false);
                        }}
                    />
                </div>

                {/* 底部控制项与时间展示 */}
                <div className="w-full flex justify-between items-center text-zinc-500 dark:text-zinc-400">
                    <div className="flex gap-3.5 items-center">
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
                            className="w-9 h-9 rounded-full text-zinc-800 dark:text-zinc-100 hover:bg-black/5 dark:hover:bg-white/10 transition-colors"
                        >
                            {playing ? (
                                <Pause className="w-4 h-4" />
                            ) : (
                                <Play className="w-4 h-4 ml-0.5" />
                            )}
                        </Button>
                        <div className="flex items-center font-mono text-xs tabular-nums text-zinc-500 dark:text-zinc-400">
                            <span className="text-zinc-800 dark:text-zinc-200 font-medium">{TimeUtil.secondToTimeStr(currentValue)}</span>
                            <span className="mx-1.5 opacity-40">/</span>
                            <span>{TimeUtil.secondToTimeStr(duration)}</span>
                        </div>
                    </div>

                    <div className="flex justify-center items-center gap-4 text-zinc-600 dark:text-zinc-400">
                        <SpeedSlider
                            speed={playbackRate}
                            onSpeedChange={setPlaybackRate}
                        />
                        <VolumeSlider
                            muted={muted}
                            onMutedChange={setMuted}
                            volume={volume}
                            onVolumeChange={setVolume}
                            sliderTrackClassName="bg-zinc-200/70 dark:bg-zinc-800/80"
                            sliderRangeClassName="bg-zinc-400 dark:bg-zinc-500"
                            sliderThumbClassName="border-zinc-400 dark:border-zinc-500 bg-white dark:bg-zinc-900 shadow-sm"
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};
PodcastControlBar.defaultProps = {
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

export default PodcastControlBar;
