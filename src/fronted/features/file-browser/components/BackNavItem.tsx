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
                'group flex cursor-pointer items-center gap-3 rounded-lg border border-dashed border-border/60 bg-background/80 px-3 py-2 text-sm transition-colors hover:border-primary/50 hover:bg-primary/5 dark:bg-muted/30'
            )}
            onClick={onClick}
            role="button"
            tabIndex={0}
            onKeyDown={handleKeyDown}
        >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground transition group-hover:bg-primary/10 group-hover:text-primary">
                {React.createElement(icon, { className: 'h-4 w-4' })}
            </div>
            <div className="flex min-w-0 flex-col">
                <span className="truncate font-medium text-muted-foreground transition group-hover:text-primary">{title}</span>
                {subtitle && (
                    <span className="truncate text-xs text-muted-foreground/80">{subtitle}</span>
                )}
            </div>
        </div>
    );
};

export default BackNavItem;
