import React from 'react';
import { Outlet } from 'react-router-dom';

import { cn } from '@/fronted/lib/utils';
import {
    SidebarInset,
    SidebarProvider,
} from '@/fronted/components/ui/sidebar';
import SettingsSidebar from '@/fronted/pages/setting/components/SettingsSidebar';

const SettingLayout = () => {
    return (
        <SidebarProvider
            style={
                {
                    '--sidebar-width': '18rem',
                } as React.CSSProperties
            }
            className={cn('h-full min-h-0')}
        >
            <SettingsSidebar />
            <SidebarInset className="overflow-hidden">
                <div className="flex-1 overflow-auto p-4 lg:p-6">
                    <Outlet />
                </div>
            </SidebarInset>
        </SidebarProvider>
    );
};

export default SettingLayout;
