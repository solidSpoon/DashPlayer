import { Link, Outlet, useLocation } from 'react-router-dom';
import React, { useMemo } from 'react';
import { Bot, Command, Compass, Database, Globe, Palette, ToggleLeft } from 'lucide-react';
import { useTranslation as useI18nTranslation } from 'react-i18next';
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from '@/fronted/components/ui/breadcrumb';
import { Separator } from '@/fronted/components/ui/separator';
import { cn } from '@/fronted/lib/utils';

export type SettingType =
    | 'service-credentials'
    | 'engine-selection'
    | 'shortcut'
    | 'storage'
    | 'appearance'
    | 'proxy'
    | 'about';

interface SettingNavDef {
    key: SettingType;
    icon: React.ElementType;
    labelKey: string;
}

const SETTING_ITEMS: SettingNavDef[] = [
    { key: 'shortcut', icon: Command, labelKey: 'sections.shortcut' },
    { key: 'appearance', icon: Palette, labelKey: 'sections.appearance' },
    { key: 'service-credentials', icon: Bot, labelKey: 'sections.serviceCredentials' },
    { key: 'engine-selection', icon: ToggleLeft, labelKey: 'sections.engineSelection' },
    { key: 'storage', icon: Database, labelKey: 'sections.storage' },
    { key: 'proxy', icon: Globe, labelKey: 'sections.proxy' },
    { key: 'about', icon: Compass, labelKey: 'sections.about' },
];

const SettingLayout = () => {
    const { t } = useI18nTranslation('settings');
    const location = useLocation();

    const currentKey = useMemo<SettingType>(() => {
        const segments = location.pathname.split('/');
        const matched = SETTING_ITEMS.find((item) => segments.includes(item.key));
        return matched ? matched.key : 'shortcut';
    }, [location.pathname]);

    const activeItem = useMemo(
        () => SETTING_ITEMS.find((item) => item.key === currentKey) || SETTING_ITEMS[0],
        [currentKey]
    );

    return (
        <div className="flex h-full w-full select-none overflow-hidden rounded-2xl bg-card text-foreground p-3 gap-4">
            {/* 浮动在白色大背景上的独立侧边栏卡片 */}
            <aside className="flex h-full w-60 flex-col rounded-xl border border-border/70 bg-card/90 shadow-sm shrink-0 overflow-hidden">
                {/* 导航菜单列表 */}
                <div className="flex-1 overflow-y-auto p-3 space-y-1 scrollbar-thin">
                    {SETTING_ITEMS.map((item) => {
                        const Icon = item.icon;
                        const isActive = currentKey === item.key;
                        const label = t(item.labelKey);

                        return (
                            <Link
                                key={item.key}
                                to={`/settings/${item.key}`}
                                className={cn(
                                    'flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-all',
                                    isActive
                                        ? 'bg-primary text-primary-foreground font-semibold shadow-xs'
                                        : 'text-muted-foreground hover:bg-muted/80 hover:text-foreground'
                                )}
                            >
                                <Icon
                                    className={cn(
                                        'h-4 w-4 shrink-0 transition-colors',
                                        isActive
                                            ? 'text-primary-foreground'
                                            : 'text-muted-foreground group-hover:text-foreground'
                                    )}
                                />
                                <span className="truncate">{label}</span>
                            </Link>
                        );
                    })}
                </div>
            </aside>

            {/* 右侧主内容区域（居中展示） */}
            <section className="flex flex-1 flex-col h-full min-w-0 overflow-hidden">
                <header className="flex h-11 shrink-0 items-center px-4">
                    <Breadcrumb>
                        <BreadcrumbList>
                            <BreadcrumbItem className="hidden sm:inline-flex">
                                <BreadcrumbLink asChild>
                                    <Link to="/settings/shortcut" className="text-muted-foreground hover:text-foreground text-sm">
                                        {t('layoutTitle')}
                                    </Link>
                                </BreadcrumbLink>
                            </BreadcrumbItem>
                            <BreadcrumbSeparator className="hidden sm:inline-flex" />
                            <BreadcrumbItem>
                                <BreadcrumbPage className="font-medium text-foreground text-sm">
                                    {t(activeItem.labelKey)}
                                </BreadcrumbPage>
                            </BreadcrumbItem>
                        </BreadcrumbList>
                    </Breadcrumb>
                </header>

                <main role="main" className="flex-1 min-h-0 overflow-y-auto px-4 py-2 md:px-8 md:py-3">
                    <div className="max-w-4xl mx-auto h-full flex flex-col">
                        <Outlet />
                    </div>
                </main>
            </section>
        </div>
    );
};

export default SettingLayout;
