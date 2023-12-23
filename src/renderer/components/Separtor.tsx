'use client';

import * as React from 'react';

export interface SeparatorProps {
    orientation?: 'horizontal' | 'vertical';
}

const Separator = ({ orientation }: SeparatorProps) => {
    if (orientation === 'horizontal') {
        return (
            <div className="w-full py-1 px-2">
                <div className="h-[1px] w-full bg-gray-300" />
            </div>
        );
    }
    return (
        <div className="h-full py-2 px-1">
            <div className="w-[1px] h-full bg-gray-300" />
        </div>
    );
};

Separator.defaultProps = {
    orientation: 'horizontal',
};

export default Separator;
