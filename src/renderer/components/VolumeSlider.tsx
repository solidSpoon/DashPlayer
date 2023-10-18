import React, { useState } from 'react';
import { FaVolumeHigh, FaVolumeLow } from 'react-icons/fa6';
import { FaVolumeMute } from 'react-icons/fa';
import { Slider } from './Slider';

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
                className="w-10 h-10 p-1 flex items-center justify-start text-white/50"
            >
                {localVolume > 0.5 && <FaVolumeHigh className="h-8 w-8" />}
                {localVolume <= 0.5 && localVolume > 0 && (
                    <FaVolumeLow className="h-7 w-7 -translate-x-1" />
                )}
                {localVolume === 0 && <FaVolumeMute className="h-8 w-8" />}
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
