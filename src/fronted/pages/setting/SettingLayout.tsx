import {Link, Outlet, useLocation, useNavigate} from 'react-router-dom';
import React, {cloneElement, ReactElement} from 'react';
import {cn} from "@/fronted/lib/utils";
import Separator from '@/fronted/components/shared/common/Separator';
import {buttonVariants} from "@/fronted/components/ui/button";
import { Bot, Command, Compass, Database, Palette, ToggleLeft } from 'lucide-react';
import { getRendererLogger } from '@/fronted/log/simple-logger';

const logger = getRendererLogger('SettingLayout');

export type SettingType =
    | 'service-credentials'
    | 'engine-selection'
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
            <Link
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
            {ele('服务凭据', 'service-credentials', <Bot />)}
            {ele('功能设置', 'engine-selection', <ToggleLeft />)}
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
