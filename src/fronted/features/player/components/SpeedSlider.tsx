import React, { useEffect, useRef, useState } from 'react';
import { cn } from "@/fronted/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from '@/fronted/components/ui/popover';
import { Button } from '@/fronted/components/ui/button';
import { Input } from '@/fronted/components/ui/input';
import { Checkbox } from '@/fronted/components/ui/checkbox';
import useSetting from '@/fronted/features/settings/settingsStore';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/fronted/components/ui/tooltip';
import { getRendererLogger } from '@/fronted/log/simple-logger';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import { Check } from 'lucide-react';

export interface SpeedSliderProps {
    speed: number;
    onSpeedChange: (speed: number) => void;
    onSelectFinish?: () => void;
    className?: string;
}

const SPEED_PRESETS = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];

const SpeedSlider = ({ speed, onSpeedChange, onSelectFinish, className }: SpeedSliderProps) => {
    const { t } = useI18nTranslation('player');
    const logger = getRendererLogger('SpeedSlider');
    const [open, setOpen] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (open) {
            setTimeout(() => {
                inputRef.current?.focus();
                inputRef.current?.select();
            }, 50);
        }
    }, [open]);

    // 订阅 settingMap 变化，确保勾选状态即时响应
    const rawStack = useSetting((s) => s.setting('userSelect.playbackRateStack'));
    const setSetting = useSetting((s) => s.setSetting);

    const favoriteList = rawStack
        .split(',')
        .map((v) => parseFloat(v))
        .filter((v) => !isNaN(v));

    const toggleFavorite = (num: number, checked: boolean) => {
        let arr = [...favoriteList];
        if (checked) {
            if (!arr.includes(num)) arr.push(num);
        } else {
            arr = arr.filter((v) => v !== num);
        }
        setSetting('userSelect.playbackRateStack', arr.join(','));
    };

    const handleCustomSpeedSubmit = (val: string) => {
        let s = parseFloat(parseFloat(val).toFixed(2));
        if (isNaN(s)) return;
        if (s > 20) s = 20;
        if (s < 0.25) s = 0.25;
        onSpeedChange(s);
        setOpen(false);
        onSelectFinish?.();
    };

    return (
        <Popover open={open} onOpenChange={setOpen}>
            <PopoverTrigger asChild>
                <Button
                    role="combobox"
                    aria-expanded={open}
                    size="sm"
                    variant="ghost"
                    className={cn(
                        'h-8 px-2.5 rounded-lg text-xs font-mono text-inherit hover:bg-black/5 dark:hover:bg-white/15 transition-colors',
                        className
                    )}
                >
                    <span className="font-mono">{speed.toFixed(2)}x</span>
                </Button>
            </PopoverTrigger>
            <PopoverContent
                side="top"
                align="center"
                sideOffset={8}
                className="w-52 p-2 bg-neutral-900/95 backdrop-blur-xl border border-white/15 text-white shadow-2xl rounded-2xl animate-in fade-in-0 zoom-in-95 duration-150"
            >
                <div className="flex flex-col gap-0.5 max-h-72 overflow-y-auto pr-0.5 [scrollbar-width:thin] [scrollbar-color:rgba(255,255,255,0.2)_transparent] [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-white/20">
                    {SPEED_PRESETS.map((num) => {
                        const isSelected = Math.abs(speed - num) < 0.001;
                        const isFavorite = favoriteList.includes(num);
                        return (
                            <div
                                key={num}
                                onClick={() => {
                                    setOpen(false);
                                    onSpeedChange(num);
                                    onSelectFinish?.();
                                }}
                                role="button"
                                tabIndex={0}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        setOpen(false);
                                        onSpeedChange(num);
                                        onSelectFinish?.();
                                    }
                                }}
                                className={cn(
                                    'group flex items-center justify-between px-2 py-1.5 rounded-lg text-xs font-mono cursor-pointer transition-colors select-none',
                                    isSelected
                                        ? 'bg-primary/20 text-primary font-medium'
                                        : 'text-neutral-300 hover:bg-white/10 hover:text-white'
                                )}
                            >
                                <div className="flex items-center gap-2">
                                    <span className="w-3.5 flex items-center justify-center">
                                        {isSelected && <Check className="w-3.5 h-3.5 text-primary stroke-[2.5]" />}
                                    </span>
                                    <span>{num.toFixed(2)}x</span>
                                </div>
                                <div
                                    className="flex items-center pl-2"
                                    onClick={(e) => e.stopPropagation()}
                                >
                                    <TooltipProvider delayDuration={200}>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <div className="flex items-center">
                                                    <Checkbox
                                                        checked={isFavorite}
                                                        onCheckedChange={(checked) => {
                                                            toggleFavorite(num, Boolean(checked));
                                                        }}
                                                        className="w-3.5 h-3.5 rounded border-white/30 data-[state=checked]:bg-primary data-[state=checked]:border-primary data-[state=checked]:text-primary-foreground"
                                                        id={`speed-check-${num}`}
                                                    />
                                                </div>
                                            </TooltipTrigger>
                                            <TooltipContent side="right" className="text-xs bg-neutral-800 text-white border-neutral-700">
                                                {t('speedSlider.favoriteHint', {
                                                    shortcut: useSetting.getState().setting('shortcut.nextPlaybackRate'),
                                                })}
                                            </TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                </div>
                            </div>
                        );
                    })}
                </div>

                <div className="pt-2 mt-1.5 border-t border-white/10 px-0.5">
                    <div className="flex items-center gap-1.5 bg-white/5 hover:bg-white/10 focus-within:bg-white/10 border border-white/10 focus-within:border-primary/60 rounded-lg px-2 py-1 transition-colors">
                        <span className="text-[11px] text-neutral-400 font-sans shrink-0">自定义</span>
                        <Input
                            ref={inputRef}
                            defaultValue={speed}
                            type="number"
                            min={0.25}
                            max={16}
                            step={0.25}
                            className="h-5 p-0 bg-transparent border-0 text-right text-xs font-mono text-white focus-visible:ring-0 focus-visible:ring-offset-0 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    handleCustomSpeedSubmit(e.currentTarget.value);
                                }
                            }}
                            onChange={(e) => {
                                const val = e.currentTarget.value;
                                logger.debug('Speed input change', { val });
                                let s = parseFloat(parseFloat(val).toFixed(2));
                                if (!isNaN(s) && s >= 0.25 && s <= 20) {
                                    onSpeedChange(s);
                                }
                            }}
                        />
                        <span className="text-xs text-neutral-400 font-mono">x</span>
                    </div>
                </div>
            </PopoverContent>
        </Popover>
    );
};

export default SpeedSlider;
