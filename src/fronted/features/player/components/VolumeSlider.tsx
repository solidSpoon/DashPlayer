import React, { useState } from 'react';
import { useTranslation as useI18nTranslation } from 'react-i18next';
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
    /**
     * 窄窗（xl 以下）把滑条收起，只留静音图标与百分比。
     * 视频控制条在窄窗里摆不下整排控件，滑条是最容易让位的一个（静音/恢复仍可点图标）；
     * 默认关闭，因为播客控制条这类宽松宿主需要完整滑条。
     */
    collapseSliderBelowXl?: boolean;
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
    sliderThumbClassName,
    collapseSliderBelowXl = false,
}: VolumeSliderProps) => {
    const { t } = useI18nTranslation('player');
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
                title={muted ? t('volumeSlider.unmute') : t('volumeSlider.mute')}
            >
                {getVolumeIcon()}
                <span className="text-xs font-mono w-6 text-left tabular-nums">
                    {muted ? '0' : Math.round(localVolume * 100)}
                </span>
            </Button>
            <div className={cn('w-20 items-center', collapseSliderBelowXl ? 'hidden xl:flex' : 'flex')}>
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

