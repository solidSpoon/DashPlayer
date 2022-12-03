import React, { useState } from 'react';
import { SeparatorProps } from 'react-resizable-layout';
import cn from '../lib/cn';
import s from './SampleSplitter.module.css';

interface SampleSplitterParam extends SeparatorProps {
    id: string;
    isVertical: boolean;
}
const SampleSplitter = ({
    id = 'drag-bar',
    isVertical = true,
    ...props
}: SampleSplitterParam) => {
    const [isFocused, setIsFocused] = useState(false);

    return (
        <div
            id={id}
            data-testid={id}
            className={cn(
                isVertical ? 'w-1 cursor-col-resize' : 'h-1 cursor-row-resize',
                'bg-amber-100',
                'hover:bg-amber-200',
                isFocused ? 'bg-amber-200' : `bg-amber-100`
            )}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            {...props}
        />
    );
};

export default SampleSplitter;
