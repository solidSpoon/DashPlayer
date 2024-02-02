import React, { useState } from 'react';
import { FaVolumeHigh, FaVolumeLow } from 'react-icons/fa6';
import { FaVolumeMute } from 'react-icons/fa';
import { Slider } from './Slider';
import { IoVolumeHigh, IoVolumeLow, IoVolumeMute, IoVolumeOff } from 'react-icons/io5';

export interface VolumeSliderProps {
    volume: number;
    onVolumeChange: (volume: number) => void;
}
const VolumeSlider = ({ volume, onVolumeChange }: VolumeSliderProps) => {
    const [localVolume, setLocalVolume] = useState<number>(volume);
    return (
        <div className="flex items-center gap-2">
            <div
                onClick={() => {
                    if (volume === 0) {
                        onVolumeChange(localVolume);
                    } else {
                        onVolumeChange(0);
                    }
                }}
                className="h-8 w-14 flex items-center justify-center rounded-full bg-white/90 pr-2 pl-1 text-neutral-500"
            >
                <IoVolumeOff className="h-6 w-6" /> {Math.floor(localVolume * 100)}
                {/*{localVolume > 0.5 && <IoVolumeHigh className="h-8 w-8" />}*/}
                {/*{localVolume <= 0.5 && localVolume > 0 && (*/}
                {/*    <IoVolumeLow className="h-7 w-7 -translate-x-1" />*/}
                {/*)}*/}
                {/*{localVolume === 0 && <IoVolumeMute className="h-8 w-8" />}*/}
            </div>
            <Slider
                className="bg-white/20 w-24"
                max={100}
                min={0}
                defaultValue={[volume * 100]}
                onValueCommit={(value) => {
                    onVolumeChange(value[0] / 100);
                    setLocalVolume(value[0] / 100);
                }}
                onValueChange={(value) => {
                    setLocalVolume(value[0] / 100);
                }}
            />
        </div>
    );
};

export default VolumeSlider;
