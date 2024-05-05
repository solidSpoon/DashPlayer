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
}

const SettingInput = ({
    title,
    description,
    placeHolder,
    value,
    setValue,
    type,
    inputWidth,
}: SettingInputProps) => {
    return (
        <div className={cn("grid w-full items-center gap-1.5 pl-2")}>
            <Label>{title}</Label>
            <Input
                className={inputWidth}
                type={type}
                   value={value}
                   onChange={(event) => setValue(event.target.value)}
                   placeholder={placeHolder}/>
            <p

                className={cn("text-sm text-muted-foreground")}

            >
                {description}
            </p>
        </div>
    );
};

SettingInput.defaultProps = {
    placeHolder: '',
    type: 'text',
    inputWidth: 'w-96',
    description: '',
};
export default SettingInput;
