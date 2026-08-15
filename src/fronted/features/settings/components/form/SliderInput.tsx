import { useEffect, useState } from 'react';
import { cn } from '@/fronted/lib/utils';
import {Slider} from "@/fronted/components/ui/slider";

export interface SliderInputProps {
    title: string;
    values: string[];
    defaultValue: string;
    setValue: (value: string) => void;
    inputWidth?: string;
    valueLabelMap?: Record<string, string>;
}
const SliderInput = ({
    title,
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
        <div className="flex items-center gap-4  text-gray-700 select-none">
            <div className="text-right w-28">{title} :</div>
            <Slider
                step={1}
                min={0}
                max={values.length - 1}
                className={cn('w-44', inputWidth)}
                value={[values.indexOf(localValue)]}
                onValueChange={(value) => {
                    setLocalValue(values[value[0]]);
                }}
                onValueCommit={(value) => {
                    setValue(values[value[0]]);
                }}
            />
            <div className="text-sm text-left w-16">{valueLabelMap?.[localValue] ?? localValue}</div>
        </div>
    );
};

SliderInput.defaultProps = {
    inputWidth: 'w-44',
    valueLabelMap: undefined,
};
export default SliderInput;
