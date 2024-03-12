import React, { useEffect, useRef, useState } from 'react';
import { cn } from '@/common/utils/Util';
import { Popover, PopoverContent, PopoverTrigger } from '@/fronted/components/ui/popover';
import { Button } from '@/fronted/components/ui/button';
import { Label } from '@/fronted/components/ui/label';
import { Input } from '@/fronted/components/ui/input';
import { Checkbox } from '@/fronted/components/ui/checkbox';
import usePlayerController from '@/fronted/hooks/usePlayerController';
import { useShallow } from 'zustand/react/shallow';
import useSetting from '@/fronted/hooks/useSetting';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/fronted/components/ui/tooltip';

export interface VolumeSliderProps {
    speed: number;
    onSpeedChange: (speed: number) => void;
    onSelectFinish?: () => void;
}

const SpeedSlider = ({ speed, onSpeedChange, onSelectFinish }: VolumeSliderProps) => {
    const [open, setOpen] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);
    useEffect(() => {
        if (open) {
            setTimeout(() => {
                inputRef.current?.focus();
            }, 0);
        }
    }, [open]);
    const { setting, setSetting } = useSetting(useShallow(s => ({
        setting: s.setting,
        setSetting: s.setSetting
    })));
    const pageSelectItem = (num: number) => {
        return (
            <>
                <div
                    onClick={() => {
                        setOpen(false);
                        onSpeedChange(num);
                        onSelectFinish?.();
                    }}
                    className={cn(
                        'flex flex-row w-full items-center justify-start px-8 py-1.5 rounded text-sm',
                        'cursor-pointer',
                        speed === num ? 'bg-primary' : ''
                    )}
                >
                    {num}
                </div>
                <div className={cn('h-full pl-2 border-l border-border')}
                >
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Checkbox
                                    checked={setting('userSelect.playbackRateStack').split(',').includes(num.toString())}
                                    onCheckedChange={(checked) => {
                                        let arr = setting('userSelect.playbackRateStack')
                                            .split(',')
                                            .map((v) => parseFloat(v))
                                            .filter((v) => !isNaN(v));
                                        if (checked) {
                                            arr.push(num);
                                        } else {
                                            arr = arr.filter((v) => v !== num);
                                        }
                                        setSetting('userSelect.playbackRateStack', arr.join(','));
                                    }}
                                    id={`speed-${num}`}
                                />
                            </TooltipTrigger>
                            <TooltipContent>
                                点击勾选几个常用的速度, 使用快捷键 {useSetting.getState().setting('shortcut.nextPlaybackRate')} 在这些速度中切换
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                </div>

            </>
        );
    };

    return (
        <Popover open={open}
                 onOpenChange={setOpen}
        >
            <PopoverTrigger asChild>
                <Button
                    role='combobox'
                    aria-expanded={open}
                    size={'sm'} variant='outline'><span className={cn('w-12')}>{speed.toFixed(2)}x</span></Button>
            </PopoverTrigger>
            <PopoverContent
                side={'top'} align={'start'}
                className='w-56 px-4 py-2'>

                <div
                    style={{
                        gridTemplateColumns: 'auto 20px'
                    }}
                    className={cn('grid grid-cols-2 gap-x-4')}
                >

                    {pageSelectItem(0.25)}
                    {pageSelectItem(0.5)}
                    {pageSelectItem(0.75)}
                    {pageSelectItem(1)}
                    {pageSelectItem(1.25)}
                    {pageSelectItem(1.5)}
                    {pageSelectItem(1.75)}
                    {pageSelectItem(2)}
                    <div className={cn('pt-3 col-span-2')}>
                        <Input
                            size={100}
                            ref={inputRef}
                            defaultValue={speed}
                            type={'number'}
                            min={0.25} // 最小速度
                            max={16} // 最大速度
                            step={0.25} // 步进值
                            className={cn('bg-secondary')}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter') {
                                    setOpen(false);
                                    let s = parseFloat(parseFloat(e.currentTarget.value).toFixed(2));
                                    if (s > 20) {
                                        s = 20;
                                    }
                                    if (s < 0.25) {
                                        s = 0.25;
                                    }
                                    onSpeedChange(s);
                                }
                            }}
                            onChange={(e) => {
                                console.log('onChange', e.currentTarget.value);
                                let s = parseFloat(parseFloat(e.currentTarget.value).toFixed(2));
                                if (s > 20) {
                                    s = 20;
                                }
                                if (s < 0.25) {
                                    s = 0.25;
                                }
                                onSpeedChange(s);
                            }}
                        />

                    </div>
                </div>

            </PopoverContent>
        </Popover>
    );
};

export default SpeedSlider;
