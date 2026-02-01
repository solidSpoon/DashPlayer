import { useEffect, useMemo, useState } from 'react';
import { cn } from '@/fronted/lib/utils';
import { Slider } from '@/fronted/components/ui/slider';

export type SliderOption = {
    value: string;
    label: string;
};

export interface SliderInputProps {
    title: string;
    options: SliderOption[];
    defaultValue: string;
    setValue: (value: string) => void;
    inputWidth?: string;
}

const SliderInput = ({
    title,
    options,
    defaultValue,
    setValue,
    inputWidth,
}: SliderInputProps) => {
    const [localValue, setLocalValue] = useState<string>(defaultValue);

    const localLabel = useMemo(() => {
        return options.find((o) => o.value === localValue)?.label ?? localValue;
    }, [localValue, options]);

    const selectedIndex = useMemo(() => {
        const idx = options.findIndex((o) => o.value === localValue);
        return idx >= 0 ? idx : 0;
    }, [localValue, options]);

    useEffect(() => {
        setLocalValue(defaultValue);
    }, [defaultValue]);
    return (
        <div className="flex items-center gap-4  text-gray-700 select-none">
            <div className="text-right w-28">{title} :</div>
            <Slider
                step={1}
                min={0}
                max={Math.max(0, options.length - 1)}
                className={cn('w-44', inputWidth)}
                value={[selectedIndex]}
                onValueChange={(value) => {
                    setLocalValue(options[value[0]]?.value ?? options[0]?.value ?? '');
                }}
                onValueCommit={(value) => {
                    setValue(options[value[0]]?.value ?? options[0]?.value ?? '');
                }}
            />
            <div className="text-sm text-left w-10">{localLabel}</div>
        </div>
    );
};

SliderInput.defaultProps = {
    inputWidth: 'w-44',
};
export default SliderInput;
