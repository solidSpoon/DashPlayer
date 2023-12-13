import React, { Suspense, useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '../../../../utils/Util';
import TitleBar from '../../../components/TitleBar/TitleBar';
import useFile from '../../../hooks/useFile';
import useLayout from '../../../hooks/useLayout';
import SideBar from '../../../components/SideBar';

const TitleBarLayout = () => {
    const videoFile = useFile((s) => s.videoFile);
    const subtitleFile = useFile((s) => s.subtitleFile);
    return (
        <div
            className={cn(
                'flex flex-col w-full h-screen font-face-arc overflow-hidden select-none text-black'
            )}
        >
            <TitleBar
                hasSubTitle={subtitleFile !== undefined}
                title={videoFile?.fileName}
                windowsButtonClassName="hover:bg-titlebarHover"
                className="bg-titlebar"
            />
            <Suspense fallback={<div>Loading...</div>}>
                <div className={cn('flex-1 h-0 w-full bg-green-100')}>
                    <Outlet key="ddddddddddddd" />
                </div>
            </Suspense>
        </div>
    );
};
export default TitleBarLayout;
