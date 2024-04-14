import {Link, Outlet, useLocation, useNavigate} from 'react-router-dom';
import React, {cloneElement, ReactElement} from 'react';
import {
    MdBuild,
    MdColorLens, MdCrueltyFree,
    MdKeyboard,
    MdOutlineGTranslate,
    MdStorage,
    MdTranslate
} from 'react-icons/md';
import {cn} from '@/common/utils/Util';
import Separator from '@/fronted/components/Separtor';
import {buttonVariants} from "@/fronted/components/ui/button";
import { Bot, Command, Compass, Database, Languages, Palette, Server, WholeWord } from 'lucide-react';

export type SettingType =
    | 'you-dao'
    | 'tenant'
    | 'open-ai'
    | 'shortcut'
    | 'storage'
    | 'update'
    | 'appearance';
const Sidebar = () => {
    const location = useLocation();
    const ele = (name: string, key: SettingType, icon: ReactElement) => {
        const pathname =
            location.pathname === '/settings'
                ? '/settings/shortcut'
                : location.pathname;
        const isCurrent = pathname.includes(key);
        return (
            // <ul
            //     onClick={() => {
            //         const s = `/settings/${key}`;
            //         console.log(s);
            //         navigate(s);
            //     }}
            //     className={cn(
            //         `flex justify-start items-center overflow-hidden h-12 py-1 px-5 rounded-lg gap-4 hover:underline`,
            //         isCurrent && 'bg-black/5'
            //     )}
            // >
            //     {cloneElement(icon, {
            //         className: cn('w-6 h-6 fill-gray-600'),
            //     })}
            //     {name}
            // </ul>
            <Link
                // key={item.href}
                to={`/settings/${key}`}
                className={cn(
                    buttonVariants({variant: "ghost"}),
                    'gap-2 text-base',
                    isCurrent
                        ? "bg-muted hover:bg-muted"
                        : "hover:bg-transparent hover:underline",
                    "justify-start"
                )}
            >
                {cloneElement(icon, {
                    className: cn('w-6 h-6 text-foreground/80'),
                })}
                {name}
            </Link>
        );
    };
    return (
        <div className="w-full h-full flex flex-col gap-2">
            {ele('快捷键', 'shortcut', <Command />)}
            {ele('外观', 'appearance', <Palette />)}
            {ele('字幕翻译', 'tenant', <Languages />)}
            {ele('查单词', 'you-dao', <WholeWord />)}
            {ele('OpenAI', 'open-ai', <Bot />)}
            {ele('存储', 'storage', <Database />)}
            {ele('版本更新', 'update', <Compass />)}
        </div>
    );
};

const SettingLayout = () => {
    return (
        <div
            className={cn(
                'w-full h-screen flex flex-col overflow-hidden select-none bg-background p-6 pt-12 gap-4 text-foreground'
            )}
        >
            <div className={cn('p-4')}>
                <h1 className={cn('text-4xl font-bold font-serif')}>
                    Settings
                </h1>
                <h2 className={cn('text-xl text-secondary-foreground mt-2 mb-4')}>
                    Dash Player
                </h2>
                <Separator orientation="horizontal" className="px-0"/>
            </div>

            <div className="flex flex-1 h-0 gap-8">
                <aside className="w-56 flex-shrink-0">
                    <Sidebar/>
                </aside>
                <main role="main" className="w-[1000px] overflow-hidden h-full">
                    <Outlet/>
                </main>
            </div>
        </div>
    );
};

export default SettingLayout;
