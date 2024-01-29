import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import React, { cloneElement, ReactElement } from 'react';
import {
    MdBuild,
    MdColorLens,
    MdKeyboard,
    MdOutlineGTranslate,
    MdStorage,
    MdTranslate,
} from 'react-icons/md';
import { cn } from '../../../../../common/utils/Util';
import Separator from '../../../../components/Separtor';

export type SettingType =
    | 'you-dao'
    | 'tenant'
    | 'shortcut'
    | 'storage'
    | 'update'
    | 'appearance';
const Sidebar = () => {
    const location = useLocation();
    const navigate = useNavigate();
    const ele = (name: string, key: SettingType, icon: ReactElement) => {
        const pathname =
            location.pathname === '/settings'
                ? '/settings/shortcut'
                : location.pathname;
        const isCurrent = pathname.includes(key);
        return (
            <ul
                onClick={() => {
                    const s = `/settings/${key}`;
                    console.log(s);
                    navigate(s);
                }}
                className={cn(
                    `flex justify-start items-center overflow-hidden h-12 py-1 px-5 rounded-lg gap-4 hover:underline`,
                    isCurrent && 'bg-black/5'
                )}
            >
                {cloneElement(icon, {
                    className: cn('w-6 h-6 fill-gray-600'),
                })}
                {name}
            </ul>
        );
    };
    return (
        <div className="w-full h-full flex flex-col gap-2">
            {ele('快捷键', 'shortcut', <MdKeyboard />)}
            {ele('外观', 'appearance', <MdColorLens />)}
            {ele('字幕翻译', 'tenant', <MdOutlineGTranslate />)}
            {ele('查单词', 'you-dao', <MdTranslate />)}
            {ele('存储', 'storage', <MdStorage />)}
            {ele('版本更新', 'update', <MdBuild />)}
        </div>
    );
};

const SettingLayout = () => {
    return (
        <div
            className={cn(
                'w-full h-screen flex flex-col overflow-hidden select-none bg-white p-6 pt-12 gap-4'
            )}
        >
            <div className={cn('p-4')}>
                <h1 className={cn('text-4xl font-bold font-serif')}>
                    Settings
                </h1>
                <h2 className={cn('text-xl text-neutral-500 mt-2 mb-4')}>
                    Dash Player
                </h2>
                <Separator orientation="horizontal" className="px-0" />
            </div>

            <div className="flex flex-1 h-0 gap-8">
                <aside className="w-56 flex-shrink-0">
                    <Sidebar />
                </aside>
                <main role="main" className="w-[1000px] overflow-hidden h-full">
                    <Outlet />
                </main>
            </div>
        </div>
    );
};

export default SettingLayout;
