import React from 'react';
import { cn } from '@/fronted/lib/utils';
import { Separator } from '@/fronted/components/ui/separator';

export interface SettingsPageShellProps {
    title: string;
    description?: React.ReactNode;
    children: React.ReactNode;
    actions?: React.ReactNode;
    className?: string;
    contentClassName?: string;
}

const SettingsPageShell = ({
    title,
    description,
    children,
    actions,
    className,
    contentClassName,
}: SettingsPageShellProps) => {
    return (
        <div className={cn('h-full min-h-0 flex flex-col', className)}>
            <div className="space-y-1">
                <h1 className="text-lg font-semibold tracking-tight text-foreground">{title}</h1>
                {description ? (
                    <p className="text-sm text-muted-foreground leading-relaxed">{description}</p>
                ) : null}
            </div>
            <Separator className="mt-3.5 mb-5 opacity-60" />

            <div
                className={cn(
                    'flex-1 min-h-0 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-rounded-full scrollbar-thumb-stone-200 dark:scrollbar-thumb-neutral-700',
                    contentClassName,
                )}
            >
                {children}
                {actions ? (
                    <div className="flex justify-end gap-2 pt-6 pb-1">{actions}</div>
                ) : null}
            </div>
        </div>
    );
};

SettingsPageShell.defaultProps = {
    description: undefined,
    actions: undefined,
    className: '',
    contentClassName: '',
};

export default SettingsPageShell;
