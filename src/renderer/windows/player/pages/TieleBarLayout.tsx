import React, { Suspense, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '../../../../common/utils/Util';
import TitleBar from '../../../components/TitleBar/TitleBar';
import useFile from '../../../hooks/useFile';
import useLayout from '../../../hooks/useLayout';
import SideBar from '../../../components/SideBar';
import Background from '../../../components/bg/Background';

const TitleBarLayout = () => {
    const videoFile = useFile((s) => s.videoFile);
    const subtitleFile = useFile((s) => s.subtitleFile);
    return (
        <div
            className={cn(
                'w-full h-screen relative'
            )}
        >
            <Background />
            <div
                className={cn('absolute w-full h-full top-0 left-0 flex flex-col font-face-arc overflow-hidden select-none text-black')}>
                <TitleBar
                    title={videoFile?.fileName}
                    windowsButtonClassName='hover:bg-black/10'
                    className=''
                />
                <Suspense fallback={<div>Loading...</div>}>
                    <div className={cn('flex-1 h-0 w-full')}>
                        <Outlet />
                    </div>
                </Suspense>
            </div>
        </div>
    );
};
export default TitleBarLayout;
