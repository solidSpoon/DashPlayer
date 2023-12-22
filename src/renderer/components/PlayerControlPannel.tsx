import React, { useEffect, useRef, useState } from 'react';
import { FaPause, FaPlay } from 'react-icons/fa';
import { useShallow } from 'zustand/react/shallow';
import { Slider } from './Slider';
import VolumeSlider from './VolumeSlider';
import usePlayerController from '../hooks/usePlayerController';
import { cn, secondToDate } from '../../common/utils/Util';

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
    playing,
}: PlayerControlPannelProps) => {
    const { playTime, duration, volume, setVolume } = usePlayerController(
        useShallow((s) => ({
            playTime: s.playTime,
            duration: s.duration,
            volume: s.volume,
            setVolume: s.setVolume,
        }))
    );
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
            const timeout = window.setTimeout(() => setMouseOverOut(true), 100);
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
                'w-full flex flex-col-reverse pt-10 h-full text-white/80',
                className
            )}
        >
            <div
                className={cn('pt-8', mouseOverOut && 'bg-gradient-to-t from-black/25 to-transparent')}
                onMouseMove={(e) => {
                    e.stopPropagation();
                    handleMouseMoveIn();
                }}
                onMouseLeave={() => {}}
            >
                <div
                    className={cn(
                        'flex flex-col items-center w-full gap-2 h-16 px-2',
                        !mouseOverOut && 'invisible'
                    )}
                >
                    <Slider
                        className="bg-white/50"
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
                    <div className="w-full flex justify-between px-2">
                        <div className="flex gap-4">
                            <div
                                onClick={() => {
                                    if (playing) {
                                        onPause?.();
                                    } else {
                                        onPlay?.();
                                    }
                                }}
                                className="flex justify-center items-center rounded-lg"
                            >
                                {playing ? (
                                    <FaPause className="w-6 h-6" />
                                ) : (
                                    <FaPlay className="w-6 h-6" />
                                )}
                            </div>
                            <div className=" h-full flex items-center">
                                {`${secondToDate(
                                    currentValue
                                )} / ${secondToDate(duration)}`}
                            </div>
                        </div>
                        <div className="h-full flex-1" />
                        <div className="flex justify-center items-center">
                            <VolumeSlider
                                volume={volume ?? 1}
                                onVolumeChange={setVolume}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
PlayerControlPannel.defaultProps = {
    className: '',
    onTimeChange: () => {},
    onPause: () => {},
    onPlay: () => {},
    playing: false,
};

export default PlayerControlPannel;
