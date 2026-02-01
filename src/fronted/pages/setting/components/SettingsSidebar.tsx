import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
    Command,
    Compass,
    Database,
    KeyRound,
    Palette,
    Settings,
    WandSparkles,
} from 'lucide-react';

import { cn } from '@/fronted/lib/utils';
import useI18n from '@/fronted/i18n/useI18n';
import { i18n } from '@/fronted/i18n/i18n';
import {
    Sidebar,
    SidebarContent,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
} from '@/fronted/components/ui/sidebar';

export type SettingRouteKey =
    | 'credentials'
    | 'features'
    | 'shortcut'
    | 'storage'
    | 'update'
    | 'appearance';

type NavItem = {
    key: SettingRouteKey;
    labelKey: string;
    icon: React.ReactNode;
};

const navItems: NavItem[] = [
    { key: 'shortcut', labelKey: 'settings.sidebar.shortcut', icon: <Command /> },
    { key: 'appearance', labelKey: 'settings.sidebar.appearance', icon: <Palette /> },
    { key: 'credentials', labelKey: 'settings.sidebar.credentials', icon: <KeyRound /> },
    { key: 'features', labelKey: 'settings.sidebar.features', icon: <WandSparkles /> },
    { key: 'storage', labelKey: 'settings.sidebar.storage', icon: <Database /> },
    { key: 'update', labelKey: 'settings.sidebar.update', icon: <Compass /> },
];

function normalizePathname(pathname: string): string {
    return pathname === '/settings' ? '/settings/shortcut' : pathname;
}

export function getActiveSettingRouteKey(pathname: string): SettingRouteKey {
    const normalized = normalizePathname(pathname);
    const match = navItems.find((item) =>
        normalized.includes(`/settings/${item.key}`)
    );
    return match?.key ?? 'shortcut';
}

export function getSettingRouteLabel(key: SettingRouteKey): string {
    const labelKey = navItems.find((item) => item.key === key)?.labelKey ?? 'settings.sidebar.shortcut';
    return i18n.t(labelKey);
}

export default function SettingsSidebar() {
    const { t } = useI18n();
    const location = useLocation();
    const activeKey = getActiveSettingRouteKey(location.pathname);

    return (
        <Sidebar variant="inset">
            <SidebarHeader className="px-4 py-3">
                <div className="flex items-center gap-2">
                    <div className="flex h-8 w-8 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
                        <Settings className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                        <div className="truncate text-sm font-semibold">
                            {t('settings.sidebar.headerTitle')}
                        </div>
                        <div className="truncate text-xs text-sidebar-foreground/70">
                            DashPlayer
                        </div>
                    </div>
                </div>
            </SidebarHeader>

            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupLabel>{t('settings.sidebar.groupLabel')}</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {navItems.map((item) => (
                                <SidebarMenuItem key={item.key}>
                                    <SidebarMenuButton
                                        asChild
                                        isActive={activeKey === item.key}
                                        tooltip={t(item.labelKey)}
                                    >
                                        <Link
                                            to={`/settings/${item.key}`}
                                            className={cn(
                                                'gap-2',
                                                'group-data-[collapsible=icon]:justify-center'
                                            )}
                                        >
                                            {item.icon}
                                            <span>{t(item.labelKey)}</span>
                                        </Link>
                                    </SidebarMenuButton>
                                </SidebarMenuItem>
                            ))}
                        </SidebarMenu>
                    </SidebarGroupContent>
                </SidebarGroup>
            </SidebarContent>
        </Sidebar>
    );
}
