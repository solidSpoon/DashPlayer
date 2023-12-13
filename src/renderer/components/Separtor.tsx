'use client';

import * as React from 'react';

export interface SeparatorProps {
    orientation?: 'horizontal' | 'vertical';
}

const Separator = ({ orientation }: SeparatorProps) => {
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
