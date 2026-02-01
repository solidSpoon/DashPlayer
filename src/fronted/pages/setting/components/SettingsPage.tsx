import React from 'react';

import { Separator } from '@/fronted/components/ui/separator';
import { cn } from '@/fronted/lib/utils';

export type SettingsPageProps = {
    title: string;
    description?: React.ReactNode;
    actions?: React.ReactNode;
    children: React.ReactNode;
    className?: string;
};

export default function SettingsPage({
    title,
    description,
    actions,
    children,
    className,
}: SettingsPageProps) {
    return (
        <div className={cn('flex min-h-0 flex-col gap-4', className)}>
            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                    <h1 className="truncate text-lg font-semibold leading-6">
                        {title}
                    </h1>
                    {description ? (
                        <div className="mt-1 text-sm text-muted-foreground">
                            {description}
                        </div>
                    ) : null}
                </div>
                {actions ? <div className="shrink-0">{actions}</div> : null}
            </div>
            <Separator />
            {children}
        </div>
    );
}

