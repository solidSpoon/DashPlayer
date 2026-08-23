import React from 'react';
import { cn } from '@/fronted/lib/utils';
import { CornerUpLeft, History } from 'lucide-react';
import PathUtil from '@/common/utils/PathUtil';

interface BackNavItemProps {
    root: boolean;
    currentPath: string;
    onClick: () => void;
}

const BackNavItem = ({ root, currentPath, onClick }: BackNavItemProps) => {
    const label = React.useMemo(() => {
        if (root || !currentPath) {
            return '';
        }
        try {
            return PathUtil.parse(currentPath).base;
        } catch (error) {
            return '';
        }
    }, [currentPath, root]);

    const icon = root ? History : CornerUpLeft;
    const title = root ? '最近浏览' : '返回上一级';
    const subtitle = root ? '查看最近打开的项目' : label ? `当前目录：${label}` : '';

    const handleKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
        if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            onClick();
        }
    };

    return (
        <div
            className={cn(
                'group flex cursor-pointer items-center gap-3 rounded-xl border border-border/60 bg-muted/30 px-3 py-2 text-sm transition-all duration-200 hover:border-primary/40 hover:bg-muted/70 hover:shadow-2xs active:scale-[0.99]'
            )}
            onClick={onClick}
            role="button"
            tabIndex={0}
            onKeyDown={handleKeyDown}
        >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-background/80 border border-border/40 text-muted-foreground transition-all duration-200 group-hover:border-primary/30 group-hover:bg-primary/10 group-hover:text-primary shadow-2xs">
                {React.createElement(icon, {
                    className: cn(
                        'h-3.5 w-3.5 transition-transform duration-200',
                        !root && 'group-hover:-translate-x-0.5'
                    )
                })}
            </div>
            <div className="flex min-w-0 flex-col gap-0.5">
                <span className="truncate text-xs font-semibold text-foreground/85 transition-colors group-hover:text-primary">{title}</span>
                {subtitle && (
                    <span className="truncate text-[11px] text-muted-foreground/80">{subtitle}</span>
                )}
            </div>
        </div>
    );
};

export default BackNavItem;
