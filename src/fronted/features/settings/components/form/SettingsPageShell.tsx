import React from 'react';
import { cn } from '@/fronted/lib/utils';
import Separator from '@/fronted/components/shared/common/Separator';

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
            <div className="space-y-1.5">
                <h1 className="text-xl font-semibold leading-7 text-foreground">{title}</h1>
                {description ? (
                    <p className="text-sm text-muted-foreground leading-6">{description}</p>
                ) : null}
            </div>
            <Separator orientation="horizontal" className="mt-4 mb-4 px-0" />

            <div
                className={cn(
                    'flex-1 min-h-0 overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-rounded-full scrollbar-thumb-stone-200',
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
