import ReactSlider from 'react-slider';
import React, { useEffect, useRef, useState } from 'react';
import { FaPause, FaPlay } from 'react-icons/fa';
import { Slider } from './Slider';
import { secondToDate } from './PlayTime';
import VolumeSlider from './VolumeSlider';

export interface PlayerControlPannelProps {
    className?: string;
    getTotalTime?: () => number;
    getCurrentTime?: () => number;
    onPause?: () => void;
    onPlay?: () => void;
    playing?: boolean;
    onTimeChange?: (time: number) => void;
    volume: number;
    onVolumeChange: (volume: number) => void;
}
const PlayerControlPannel = ({
    className,
    onTimeChange,
    onPause,
    onPlay,
    playing,
    getCurrentTime,
    getTotalTime,
    volume,
    onVolumeChange,
}: PlayerControlPannelProps) => {
    const [mouseOver, setMouseOver] = useState<boolean>(false);
    const [maxValue, setMaxValue] = useState(0);
    const [currentValue, setCurrentValue] = useState(0);
    const [selecting, setSelecting] = useState(false);
    const mouseOverTimeout = useRef<NodeJS.Timeout | undefined>(undefined);
    // const currentValueUpdateTime
    useEffect(() => {
        const update = () => {
            console.log('update');
            setMaxValue(getTotalTime?.() ?? 0);
            if (selecting) return;
            setCurrentValue(getCurrentTime?.() ?? 0);
        };
        const timeout = setTimeout(update, 100);
        return () => {
            clearInterval(timeout);
        };
    }, [getTotalTime, getCurrentTime, currentValue, selecting]);

    const onMouseOver = () => {
        if (mouseOverTimeout.current !== undefined) {
            clearTimeout(mouseOverTimeout.current);
        }
        mouseOverTimeout.current = setTimeout(() => {
            setMouseOver(true);
        }, 200);
    };
    const onMouseLeave = () => {
        if (mouseOverTimeout.current !== undefined) {
            clearTimeout(mouseOverTimeout.current);
        }
        mouseOverTimeout.current = setTimeout(() => {
            setMouseOver(false);
        }, 1000);
    };

    return (
        <div
            onMouseOver={onMouseOver}
            onMouseLeave={onMouseLeave}
            className={`w-full flex flex-col-reverse pt-10 h-1/2 ${className}`}
        >
            <div
                className={`flex flex-col items-center w-full gap-2 h-16 ${
                    mouseOver ? '' : 'invisible'
                }`}
            >
                <Slider
                    className="bg-white/50"
                    max={maxValue}
                    min={0}
                    value={[currentValue]}
                    onValueChange={(value) => {
                        console.log('onValueChange', value);
                        setCurrentValue(value[0]);
                        setSelecting(true);
                        onPause?.();
                    }}
                    onValueCommit={(value) => {
                        onTimeChange?.(value[0]);
                        setSelecting(false);
                    }}
                />
                <div className="w-full flex justify-between px-3">
                    <div className="flex gap-4">
                        <div
                            onClick={() => {
                                if (playing) {
                                    onPause?.();
                                } else {
                                    onPlay?.();
                                }
                            }}
                            className="flex justify-center w-10 h-10 bg-white/20 items-center rounded-lg"
                        >
                            {playing ? (
                                <FaPause className="w-6 h-6 text-white/80" />
                            ) : (
                                <FaPlay className="w-6 h-6 text-white/80" />
                            )}
                        </div>
                        <div className=" h-full flex items-center">
                            {`${secondToDate(currentValue)} / ${secondToDate(
                                maxValue
                            )}`}
                        </div>
                    </div>
                    <div className="h-full flex-1" />
                    <div className="flex justify-center items-center">
                        <VolumeSlider
                            volume={volume ?? 1}
                            onVolumeChange={onVolumeChange}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};
PlayerControlPannel.defaultProps = {
    className: '',
    getTotalTime: () => 0,
    getCurrentTime: () => 0,
    onTimeChange: () => {},
    onPause: () => {},
    onPlay: () => {},
    playing: false,
};

export default PlayerControlPannel;
