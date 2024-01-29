import React from 'react';
import { Outlet } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { cn } from '../../../../common/utils/Util';
import useLayout, { cpW } from '../../../hooks/useLayout';
import SideBar from '../../../components/SideBar';
import Background from '../../../components/bg/Background';
import useSystem from '../../../hooks/useSystem';

const Layout = () => {
    const showSideBar = useLayout((s) => s.showSideBar) || true;
    const w = cpW.bind(
        null,
        useLayout((s) => s.width)
    );
    const isWindows = useSystem((s) => s.isWindows);
    return (
        <div
            className={cn('grid grid-cols-2 grid-rows-1 h-full w-full')}
            style={{
                gridTemplateColumns: w('xl')
                    ? '15% 85%'
                    : '65px calc(100% - 65px)', // 这里定义每列的大小
                gridTemplateRows: '100%', // 这里定义每行的大小
            }}
        >
            {showSideBar && (
                <div
                    key="side-bar"
                    className={cn(
                        'col-start-1 col-end-2 row-start-1 row-end-2'
                    )}
                >
                    <SideBar compact={!w('xl')} />
                </div>
            )}
            <motion.div
                layout
                className={cn('p-2')}
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
                    <div
                        className={cn(
                            'w-full h-full drop-shadow-lg rounded overflow-hidden'
                        )}
                    >
                        <Outlet />
                    </div>
                </AnimatePresence>
            </motion.div>
        </div>
    );
};
export default Layout;
