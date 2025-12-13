import React from 'react';
import { cn } from '@/fronted/lib/utils';

const TitleBarMac = () => {
    return (
        <div className={cn('w-full h-10 absolute top-0 z-50 flex')}>
            <div className={cn('no-drag w-20 h-full')} />
            <div
                className={cn('drag flex-1 h-full')}
                onDoubleClick={() => {
                    // onDoubleClick();
                }}
            />
        </div>
    );
};
TitleBarMac.defaultProps = {
};
export default TitleBarMac;
