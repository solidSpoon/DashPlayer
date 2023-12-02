import React, { useEffect } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '../../../../utils/Util';
import TitleBar from '../../../components/TitleBar/TitleBar';
import useFile from '../../../hooks/useFile';
import useLayout from '../../../hooks/useLayout';
import SideBar from '../../../components/SideBar';

const Layout = () => {
    const videoFile = useFile((s) => s.videoFile);
    const subtitleFile = useFile((s) => s.subtitleFile);
    const showSideBar = useLayout((s) => s.showSideBar);
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
            <div className={cn('flex-1 h-0 w-full bg-green-100')}>
                <div
                    className={cn('grid grid-cols-2 grid-rows-1 h-full')}
                    style={{
                        gridTemplateColumns: '15% 85%', // 这里定义每列的大小
                        gridTemplateRows: '100%', // 这里定义每行的大小
                    }}
                >
                    <AnimatePresence>
                        {showSideBar && (
                            <motion.div
                                className={cn(
                                    'col-start-1 col-end-2 row-start-1 row-end-2'
                                )}
                                initial={{ x: -1000 }}
                                animate={{
                                    x: 0,
                                }}
                                exit={{ x: -1000 }}
                                transition={{
                                    type: 'tween',
                                    duration: 0.2,
                                }}
                            >
                                <SideBar />
                            </motion.div>
                        )}
                    </AnimatePresence>
                    <motion.div
                        layout
                        style={{
                            gridArea: showSideBar
                                ? '1 / 2 / -1 / -1'
                                : '1 / 1 / -1 / -1',
                        }}
                        transition={{
                            type: 'tween',
                            duration: 0.2,
                        }}
                    >
                        <AnimatePresence mode="wait">
                            <Outlet key="ddddddddddddd" />
                        </AnimatePresence>
                    </motion.div>
                </div>
            </div>
        </div>
    );
};
export default Layout;
