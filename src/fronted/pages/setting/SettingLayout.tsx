import {Link, Outlet, useLocation} from 'react-router-dom';
import React, {cloneElement, ReactElement} from 'react';
import {cn} from "@/fronted/lib/utils";
import {buttonVariants} from "@/fronted/components/ui/button";
import { Bot, Command, Compass, Database, Palette, ToggleLeft } from 'lucide-react';
import { useTranslation as useI18nTranslation } from 'react-i18next';

export type SettingType =
    | 'service-credentials'
    | 'engine-selection'
    | 'shortcut'
    | 'storage'
    | 'update'
    | 'appearance';
const Sidebar = () => {
    const { t } = useI18nTranslation('settings');
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
                    'gap-2 text-sm h-10',
                    isCurrent
                        ? 'bg-muted hover:bg-muted text-foreground'
                        : 'hover:bg-muted/60 text-muted-foreground hover:text-foreground',
                    "justify-start"
                )}
            >
                {cloneElement(icon, {
                    className: cn('w-4 h-4 text-foreground/80'),
                })}
                {name}
            </Link>
        );
    };
    return (
        <div className="w-full h-full flex flex-col gap-1.5 p-2 rounded-xl border border-border/60 bg-card">
            {ele(t('sections.shortcut'), 'shortcut', <Command />)}
            {ele(t('sections.appearance'), 'appearance', <Palette />)}
            {ele(t('sections.serviceCredentials'), 'service-credentials', <Bot />)}
            {ele(t('sections.engineSelection'), 'engine-selection', <ToggleLeft />)}
            {ele(t('sections.storage'), 'storage', <Database />)}
            {ele(t('sections.update'), 'update', <Compass />)}
        </div>
    );
};

const SettingLayout = () => {
    const { t } = useI18nTranslation('settings');
    return (
        <div
            className={cn(
                'w-full h-screen flex flex-col overflow-hidden select-none bg-background px-6 py-4 gap-4 text-foreground'
            )}
        >
            <div className={cn('px-2 py-1')}>
                <div className="flex items-baseline gap-3">
                    <h1 className={cn('text-2xl font-semibold tracking-tight')}>
                        {t('layoutTitle')}
                    </h1>
                    <p className="text-sm text-muted-foreground">
                        {t('layoutSubtitle')}
                    </p>
                </div>
            </div>

            <div className="flex flex-1 h-0 gap-4 min-h-0">
                <aside className="w-56 flex-shrink-0 min-h-0">
                    <Sidebar/>
                </aside>
                <main role="main" className="min-w-0 flex-1 overflow-hidden h-full">
                    <div className="h-full min-h-0 rounded-xl border border-border/60 bg-card p-6">
                        <Outlet/>
                    </div>
                </main>
            </div>
        </div>
    );
};

export default SettingLayout;
