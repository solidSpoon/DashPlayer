import React from 'react';
import { cn } from '@/fronted/lib/utils';
import { Separator } from '@/fronted/components/ui/separator';

export interface SettingCardProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
    title?: React.ReactNode;
    description?: React.ReactNode;
    icon?: React.ElementType;
    headerAction?: React.ReactNode;
    children: React.ReactNode;
}

export interface SettingRowProps extends Omit<React.HTMLAttributes<HTMLDivElement>, 'title'> {
    title: React.ReactNode;
    description?: React.ReactNode;
    icon?: React.ElementType;
    children?: React.ReactNode;
    alignTop?: boolean;
}

/**
 * 设置项卡片容器：统一承载一组相关的设置项
 */
export const SettingCard = ({
    title,
    description,
    icon: Icon,
    headerAction,
    children,
    className,
    ...props
}: SettingCardProps) => {
    const hasHeader = title || description || headerAction;

    return (
        <div
            className={cn(
                'rounded-xl border border-border/70 bg-card/50 shadow-xs overflow-hidden transition-all',
                className
            )}
            {...props}
        >
            {hasHeader && (
                <div className="flex flex-col gap-2 p-4 sm:flex-row sm:items-center sm:justify-between border-b border-border/50 bg-muted/20">
                    <div className="space-y-0.5">
                        <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                            {Icon && <Icon className="h-4 w-4 text-primary" />}
                            {title}
                        </div>
                        {description && (
                            <p className="text-xs text-muted-foreground">{description}</p>
                        )}
                    </div>
                    {headerAction && <div className="shrink-0">{headerAction}</div>}
                </div>
            )}
            <div className="divide-y divide-border/50">{children}</div>
        </div>
    );
};

/**
 * 单条设置行：左侧文案（标题+说明），右侧操作控件
 */
export const SettingRow = ({
    title,
    description,
    icon: Icon,
    children,
    alignTop = false,
    className,
    ...props
}: SettingRowProps) => {
    return (
        <div
            className={cn(
                'flex flex-col gap-3 p-4 sm:flex-row sm:justify-between transition-colors hover:bg-muted/10',
                alignTop ? 'sm:items-start' : 'sm:items-center',
                className
            )}
            {...props}
        >
            <div className="space-y-1 sm:max-w-[65%] min-w-0">
                <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                    {Icon && <Icon className="h-4 w-4 text-muted-foreground shrink-0" />}
                    <span>{title}</span>
                </div>
                {description && (
                    <div className="text-xs text-muted-foreground leading-relaxed break-words">
                        {description}
                    </div>
                )}
            </div>
            {children && (
                <div className="flex shrink-0 items-center gap-2 sm:justify-end min-w-0">
                    {children}
                </div>
            )}
        </div>
    );
};
