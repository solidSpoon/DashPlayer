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
            tabIndex={0}
            className={cn(
                isVertical ? 'w-5' : 'h-5',
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
