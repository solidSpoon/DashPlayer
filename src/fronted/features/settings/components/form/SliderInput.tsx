import React from 'react';
import { cn } from '@/fronted/lib/utils';

export interface SliderInputProps {
    title?: string;
    values: string[];
    /** 当前选中的档位。完全受控：点击只回调 setValue，选中态由父层的值回流决定。 */
    value: string;
    setValue: (value: string) => void;
    inputWidth?: string;
    valueLabelMap?: Record<string, string>;
}

/**
 * 分段档位选择器（字号一类的小档位用）。
 *
 * 不保存本地副本：`value` 由父层受控（设置页里是 react-hook-form 的 setValue +
 * useWatch），点击后父层立刻回流新值，因此不需要用 effect 把 prop 同步进 state，
 * 也就不会出现「本地态与表单态悄悄分叉」。
 *
 * @param values 档位取值列表，顺序即展示顺序。
 * @param value 当前选中档位。
 * @param setValue 选中某档时的回调。
 * @param valueLabelMap 档位取值到展示文案的映射，缺省直接显示取值。
 * @param inputWidth 额外的宽度类名。
 */
const SliderInput = ({
    values,
    value,
    setValue,
    inputWidth,
    valueLabelMap,
}: SliderInputProps) => {
    return (
        <div
            className={cn(
                'inline-flex items-center p-1 rounded-xl bg-muted/60 dark:bg-neutral-800/80 border border-border/60 select-none',
                inputWidth
            )}
        >
            {values.map((val, idx) => {
                const isSelected = value === val;
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
                        onClick={() => setValue(val)}
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

export default SliderInput;
