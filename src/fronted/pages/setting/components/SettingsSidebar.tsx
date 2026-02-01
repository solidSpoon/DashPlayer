import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
    Bot,
    Command,
    Compass,
    Database,
    Palette,
    Settings,
} from 'lucide-react';

import { cn } from '@/fronted/lib/utils';
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
    | 'services'
    | 'shortcut'
    | 'storage'
    | 'update'
    | 'appearance';

type NavItem = {
    key: SettingRouteKey;
    label: string;
    icon: React.ReactNode;
};

const navItems: NavItem[] = [
    { key: 'shortcut', label: '快捷键', icon: <Command /> },
    { key: 'appearance', label: '外观', icon: <Palette /> },
    { key: 'services', label: '服务配置', icon: <Bot /> },
    { key: 'storage', label: '存储', icon: <Database /> },
    { key: 'update', label: '版本更新', icon: <Compass /> },
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
    return navItems.find((item) => item.key === key)?.label ?? '快捷键';
}

export default function SettingsSidebar() {
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
                            Settings
                        </div>
                        <div className="truncate text-xs text-sidebar-foreground/70">
                            DashPlayer
                        </div>
                    </div>
                </div>
            </SidebarHeader>

            <SidebarContent>
                <SidebarGroup>
                    <SidebarGroupLabel>设置</SidebarGroupLabel>
                    <SidebarGroupContent>
                        <SidebarMenu>
                            {navItems.map((item) => (
                                <SidebarMenuItem key={item.key}>
                                    <SidebarMenuButton
                                        asChild
                                        isActive={activeKey === item.key}
                                        tooltip={item.label}
                                    >
                                        <Link
                                            to={`/settings/${item.key}`}
                                            className={cn(
                                                'gap-2',
                                                'group-data-[collapsible=icon]:justify-center'
                                            )}
                                        >
                                            {item.icon}
                                            <span>{item.label}</span>
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

