import React, { Suspense } from 'react';
import { Outlet } from 'react-router-dom';
import { cn } from '../../../../common/utils/Util';
import TitleBar from '../../../components/TitleBar/TitleBar';

const TitleBarLayout = () => {
    return (
        <div
            className={cn(
                'w-full h-screen bg-stone-200 flex flex-col font-face-arc overflow-hidden select-none text-black'
            )}
        >
            <TitleBar className="" />
            <Suspense fallback={<div>Loading...</div>}>
                <div className={cn('flex-1 h-0 w-full')}>
                    <Outlet />
                </div>
            </Suspense>
        </div>
    );
};
export default TitleBarLayout;
