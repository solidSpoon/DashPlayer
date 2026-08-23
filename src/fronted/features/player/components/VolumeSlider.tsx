import React, { useState } from 'react';
import { Slider } from '@/fronted/components/ui/slider';
import { Button } from '@/fronted/components/ui/button';
import { cn } from '@/fronted/lib/utils';
import { Volume, Volume1, Volume2, VolumeX } from 'lucide-react';

export interface VolumeSliderProps {
    volume: number;
    onVolumeChange: (volume: number) => void;
    muted: boolean;
    onMutedChange: (muted: boolean) => void;
}

const VolumeSlider = ({ volume, onVolumeChange, muted, onMutedChange }: VolumeSliderProps) => {
    const [localVolume, setLocalVolume] = useState<number>(volume);

    const getVolumeIcon = () => {
        if (muted || localVolume === 0) {
            return <VolumeX className="h-4 w-4" />;
        }
        if (localVolume <= 0.5) {
            return <Volume1 className="h-4 w-4" />;
        }
        return <Volume2 className="h-4 w-4" />;
    };

    return (
        <div className="flex items-center gap-1.5 font-mono text-white/90">
            <Button
                size="sm"
                variant="ghost"
                onClick={() => onMutedChange(!muted)}
                className="h-8 px-2 rounded-lg text-white/90 hover:text-white hover:bg-white/15 transition-colors gap-1.5"
                title={muted ? '取消静音' : '静音'}
            >
                {getVolumeIcon()}
                <span className="text-xs font-mono w-6 text-left tabular-nums">
                    {muted ? '0' : Math.round(localVolume * 100)}
                </span>
            </Button>
            <div className="w-20 flex items-center">
                <Slider
                    max={100}
                    min={0}
                    value={[muted ? 0 : localVolume * 100]}
                    onValueChange={(value) => {
                        const next = value[0] / 100;
                        if (muted && next > 0) {
                            onMutedChange(false);
                        }
                        onVolumeChange(next);
                        setLocalVolume(next);
                    }}
                />
            </div>
        </div>
    );
};

export default VolumeSlider;

