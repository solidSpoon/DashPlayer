import React, { useEffect, useRef, useState } from 'react';
import { Pause, Play } from 'lucide-react';
import { shallow } from 'zustand/shallow';

import VolumeSlider from '../VolumeSlider';
import SpeedSlider from '../speed-slider';
import { Slider } from '@/fronted/components/ui/slider';
import { Card } from '@/fronted/components/ui/card';
import useLayout from '@/fronted/hooks/useLayout';
import FullscreenButton from './FullscreenButton';
import { Button } from '@/fronted/components/ui/button';
import TimeUtil from '@/common/utils/TimeUtil';
import { getRendererLogger } from '@/fronted/log/simple-logger';
import { cn } from '@/fronted/lib/utils';
import { usePlayerV2State } from '@/fronted/hooks/usePlayerV2State';
import { playerV2Actions } from '@/fronted/components/feature/player/player-v2';

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
    const logger = getRendererLogger('PlayerControlPannel');
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
        <div className="h-16 flex w-full flex-col justify-end">
            <Card
                className={cn(
                    'w-full p-2 backdrop-blur bg-background/50 rounded-none border-0 border-t',
                    !mouseOver && 'bg-transparent border-none backdrop-blur-0',
                    className
                )}
                onMouseOver={() => {
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
                        <div className="h-full flex items-center w-42 font-mono">
                            {`${TimeUtil.secondToTimeStr(currentValue)}/${TimeUtil.secondToTimeStr(duration)}`}
                        </div>
                    </div>
                    <Slider
                        className="flex-1"
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
                            playerV2Actions.setAutoPause(false);
                            playerV2Actions.setSingleRepeat(false);
                            setSelecting(false);
                        }}
                    />
                    <div className="flex justify-center items-end gap-4">
                        <SpeedSlider
                            speed={playbackRate}
                            onSpeedChange={(speed) => playerV2Actions.setPlaybackRate(speed)}
                            onSelectFinish={() => {
                                setMouseOver(false);
                            }}
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
