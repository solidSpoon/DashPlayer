import React, { useState } from 'react';
import {Slider} from "@/fronted/components/ui/slider";
import {Toggle} from "@/fronted/components/ui/toggle";
import {cn} from "@/fronted/lib/utils";
import {Volume, Volume1, Volume2, VolumeX} from "lucide-react";

export interface VolumeSliderProps {
    volume: number;
    onVolumeChange: (volume: number) => void;
    muted: boolean;
    onMutedChange: (muted: boolean) => void;
}
const VolumeSlider = ({ volume, onVolumeChange, muted, onMutedChange }: VolumeSliderProps) => {
    // const [bkVolume, setBkVolume] = useLocalStorage('volume', 0.5);
    const [localVolume, setLocalVolume] = useState<number>(volume);
    // const[pressed, setPressed] = useState(false);
    return (
        <div className="flex items-center gap-2 font-mono">
            <Toggle
                size={'sm'}
                pressed={muted}
                onPressedChange={() => {
                    onMutedChange(!muted);
                }}
                className="flex items-center justify-center"
            >
                {/*<IoVolumeOff className="h-6 w-6"/>*/}
                {localVolume > 0.5 && !muted && <Volume2  className="h-6 w-6"/>}
                {localVolume <= 0.5&& !muted && localVolume > 0 && (
                    <Volume1 className="h-6 w-6"/>
                )}
                {(localVolume === 0 && !muted) && <Volume  className="h-6 w-6"/>}
                {muted && <VolumeX  className="h-6 w-6"/>}
                <span className={cn('w-7')}>{Math.floor(localVolume * 100)}</span>
            </Toggle>
            <Slider
                className="w-24"
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
