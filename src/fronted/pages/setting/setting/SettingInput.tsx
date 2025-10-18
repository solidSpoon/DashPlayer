import {cn} from "@/fronted/lib/utils";
import {Input} from "@/fronted/components/ui/input";
import {Label} from "@/fronted/components/ui/label";
import * as React from "react";

export interface SettingInputProps {
    title: string;
    placeHolder?: string;
    value: string;
    setValue: (value: string) => void;
    type?: string;
    inputWidth?: string;
    description?: string;
    className?: string;
    onBlur?: () => void;
}

const SettingInput = React.forwardRef<HTMLInputElement, SettingInputProps>(
    (
        {
            title,
            description,
            placeHolder,
            value,
            setValue,
            type,
            inputWidth,
            className,
            onBlur,
        },
        ref,
    ) => {
        return (
            <div className={cn('grid w-full items-center gap-1.5 pl-2', className)}>
                <Label>{title}</Label>
                <Input
                    ref={ref}
                    className={inputWidth}
                    type={type}
                    value={value}
                    onChange={(event) => setValue(event.target.value)}
                    onBlur={onBlur}
                    placeholder={placeHolder}
                />
                <p className={cn('text-sm text-muted-foreground')}>
                    {description}
                </p>
            </div>
        );
    }
);

SettingInput.displayName = 'SettingInput';

SettingInput.defaultProps = {
    placeHolder: '',
    type: 'text',
    inputWidth: 'w-96',
    description: '',
    className: '',
};
export default SettingInput;
