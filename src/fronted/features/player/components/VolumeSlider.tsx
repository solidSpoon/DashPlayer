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
    /** 整条控件（图标按钮 + 滑杆）的外层样式 */
    className?: string;
    /**
     * 静音按钮在宿主控制条上的外观，语义同 SpeedSliderProps.triggerClassName：
     * 默认跟随应用主题（亮色宿主），恒为深色的视频控制条要传 DARK_BAR_BUTTON_HOVER。
     */
    triggerClassName?: string;
    sliderTrackClassName?: string;
    sliderRangeClassName?: string;
    sliderThumbClassName?: string;
}

const VolumeSlider = ({
    volume,
    onVolumeChange,
    muted,
    onMutedChange,
    className,
    triggerClassName,
    sliderTrackClassName,
    sliderRangeClassName,
    sliderThumbClassName
}: VolumeSliderProps) => {
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
        <div className={cn("flex items-center gap-1.5 font-mono text-inherit", className)}>
            <Button
                size="sm"
                variant="ghost"
                onClick={() => onMutedChange(!muted)}
                className={cn(
                    // 默认 hover 跟随应用主题（亮色宿主）；深色控制条由 triggerClassName 覆盖
                    'h-8 px-2 rounded-lg text-inherit hover:bg-black/5 dark:hover:bg-white/15 transition-colors gap-1.5',
                    triggerClassName
                )}
                title={muted ? '取消静音' : '静音'}
            >
                {getVolumeIcon()}
                <span className="text-xs font-mono w-6 text-left tabular-nums">
                    {muted ? '0' : Math.round(localVolume * 100)}
                </span>
            </Button>
            <div className="w-20 flex items-center">
                <Slider
                    trackClassName={sliderTrackClassName}
                    rangeClassName={sliderRangeClassName}
                    thumbClassName={sliderThumbClassName}
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

