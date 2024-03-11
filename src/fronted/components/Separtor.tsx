'use client';

import * as React from 'react';
import { cn } from '@/common/utils/Util';

export interface SeparatorProps {
    orientation?: 'horizontal' | 'vertical';
    className?: string;
}

const Separator = ({ orientation, className }: SeparatorProps) => {
    if (orientation === 'horizontal') {
        return (
            <div className={cn('w-full py-1 px-2', className)}>
                <div className="h-[1px] w-full bg-gray-300" />
            </div>
        );
    }
    return (
        <div className={cn('h-full py-2 px-1', className)}>
            <div className="w-[1px] h-full bg-gray-300" />
        </div>
    );
};

Separator.defaultProps = {
    orientation: 'horizontal',
    className: '',
};

export default Separator;
