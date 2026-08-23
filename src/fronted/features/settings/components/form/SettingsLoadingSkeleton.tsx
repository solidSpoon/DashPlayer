import React from 'react';
import SettingsPageShell from '@/fronted/features/settings/components/form/SettingsPageShell';
import { Skeleton } from '@/fronted/components/ui/skeleton';

export const SettingsLoadingSkeleton = ({
    title,
    description,
}: {
    title: string;
    description?: string;
}) => {
    return (
        <div className="w-full h-full min-h-0">
            <SettingsPageShell title={title} description={description} contentClassName="space-y-6">
                <div className="space-y-4">
                    <div className="rounded-xl border border-border/70 p-4 space-y-4">
                        <div className="flex justify-between items-center">
                            <div className="space-y-2">
                                <Skeleton className="h-4 w-32" />
                                <Skeleton className="h-3 w-48" />
                            </div>
                            <Skeleton className="h-9 w-36" />
                        </div>
                        <div className="flex justify-between items-center">
                            <div className="space-y-2">
                                <Skeleton className="h-4 w-28" />
                                <Skeleton className="h-3 w-40" />
                            </div>
                            <Skeleton className="h-9 w-48" />
                        </div>
                    </div>
                </div>
            </SettingsPageShell>
        </div>
    );
};
