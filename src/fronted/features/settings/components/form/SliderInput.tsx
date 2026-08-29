import React, { useEffect, useState } from 'react';
import { cn } from '@/fronted/lib/utils';

export interface SliderInputProps {
    title?: string;
    values: string[];
    defaultValue: string;
    setValue: (value: string) => void;
    inputWidth?: string;
    valueLabelMap?: Record<string, string>;
}

const SliderInput = ({
    values,
    defaultValue,
    setValue,
    inputWidth,
    valueLabelMap,
}: SliderInputProps) => {
    const [localValue, setLocalValue] = useState<string>(defaultValue);

    useEffect(() => {
        setLocalValue(defaultValue);
    }, [defaultValue]);

    return (
        <div
            className={cn(
                'inline-flex items-center p-1 rounded-xl bg-muted/60 dark:bg-neutral-800/80 border border-border/60 select-none',
                inputWidth
            )}
        >
            {values.map((val, idx) => {
                const isSelected = localValue === val;
                const label = valueLabelMap?.[val] ?? val;
                
                // 视觉字号阶梯示意：A 小中大
                const fontScaleClass = idx === 0 
                    ? 'text-xs' 
                    : idx === 1 
                    ? 'text-sm' 
                    : 'text-base';

                return (
                    <button
                        key={val}
                        type="button"
                        onClick={() => {
                            setLocalValue(val);
                            setValue(val);
                        }}
                        className={cn(
                            'flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-medium transition-all duration-150 cursor-pointer',
                            isSelected
                                ? 'bg-background text-foreground shadow-xs ring-1 ring-black/5 dark:ring-white/10'
                                : 'text-muted-foreground hover:text-foreground hover:bg-background/40'
                        )}
                    >
                        <span className={cn('font-serif font-bold opacity-80', fontScaleClass)}>A</span>
                        <span>{label}</span>
                    </button>
                );
            })}
        </div>
    );
};

SliderInput.defaultProps = {
    inputWidth: undefined,
    valueLabelMap: undefined,
};

export default SliderInput;
