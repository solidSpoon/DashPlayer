import React from 'react';
import { cn } from '@/fronted/lib/utils';

/**
 * 页面标题栏参数。
 */
export interface PageHeaderProps {
    /** 页面主标题。 */
    title: string;
    /** 页面副标题，可选。 */
    description?: React.ReactNode;
    /** 标题栏右侧扩展区域，可放按钮或状态图标。 */
    rightSlot?: React.ReactNode;
    /** 外层容器扩展样式。 */
    className?: string;
}

/**
 * 统一页面标题栏。
 *
 * 行为说明：
 * - 采用与 Settings Center 一致的标题与副标题排版。
 * - 标题与副标题同一行基线对齐，保证跨页面视觉统一。
 */
const PageHeader = ({ title, description, rightSlot, className }: PageHeaderProps) => {
    return (
        <div className={cn('px-2 py-1', className)}>
            <div className="flex items-baseline justify-between gap-4">
                <div className="flex items-baseline gap-3 min-w-0">
                    <h1 className="text-2xl font-semibold tracking-tight text-foreground">{title}</h1>
                    {description ? (
                        <p className="text-sm text-muted-foreground truncate">{description}</p>
                    ) : null}
                </div>
                {rightSlot}
            </div>
        </div>
    );
};

PageHeader.defaultProps = {
    description: undefined,
    rightSlot: undefined,
    className: '',
};

export default PageHeader;
