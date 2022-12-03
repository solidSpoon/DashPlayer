import React, { useState } from 'react';
import cn from '../lib/cn';
import s from './SampleSplitter.module.css';

const SampleSplitter = ({
    id = 'drag-bar',
    dir,
    isDragging,
    ...props
}: any) => {
    const [isFocused, setIsFocused] = useState(false);

    return (
        <div
            id={id}
            data-testid={id}
            tabIndex={0}
            className={cn(
                s.sampleDragBar,
                dir === 'horizontal' && s.sampleDragBarHorizontal,
                (isDragging || isFocused) && s.sampleDragBarDragging
            )}
            onFocus={() => setIsFocused(true)}
            onBlur={() => setIsFocused(false)}
            {...props}
        />
    );
};

export default SampleSplitter;
