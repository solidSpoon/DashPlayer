import React from 'react';
import { Outlet } from 'react-router-dom';
import {cn} from "@/fronted/lib/utils";
import useLayout, { cpW } from '@/fronted/hooks/useLayout';
import SideBar from '@/fronted/components/layout/SideBar';

const Layout = () => {
    const showSideBar = useLayout((s) => s.showSideBar) || true;
    const w = cpW.bind(
        null,
        useLayout((s) => s.width)
    );
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
            <div
                className={cn('p-2')}
                style={{
                    gridArea: showSideBar
                        ? '1 / 2 / -1 / -1'
                        : '1 / 1 / -1 / -1',
                }}
            >
                <div
                    className={cn(
                        'w-full h-full drop-shadow-lg rounded overflow-hidden'
                    )}
                >
                    <Outlet />
                </div>
            </div>
        </div>
    );
};
export default Layout;
