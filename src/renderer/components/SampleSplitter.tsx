import React, { useState } from 'react';
import { SeparatorProps } from 'react-resizable-layout';
import cn from '../lib/cn';

interface SampleSplitterParam extends SeparatorProps {
    id: string;
    isVertical: boolean;
}
const SampleSplitter = ({
    id = 'drag-bar',
    isVertical = true,
    ...props
}: SampleSplitterParam) => {
    return (
        <div
            id={id}
            data-testid={id}
            className={cn(
                isVertical
                    ? 'w-1 cursor-col-resize'
                    : 'h-1 cursor-row-resize z-50',
                'hover:bg-neutral-600',
                'bg-neutral-700',
                'drop-shadow',
                'shadow-inner'
            )}
            {...props}
        />
    );
};

export default SampleSplitter;
