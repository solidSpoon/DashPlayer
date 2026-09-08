import React from 'react';
import { ChevronDown, ChevronRight, HelpCircle } from 'lucide-react';
import { cn } from '@/fronted/lib/utils';

export interface ManualDownloadGuideProps {
    /** 折叠条上的标题，如"网络不佳？查看手动下载教程"。 */
    title: string;
    /**
     * 外壳样式：
     * - `card`：独立描边卡片（设置页直接放在卡片内容区时使用）；
     * - `plain`：无边框展开区（嵌套在模型卡片内部时使用，避免卡片套卡片）。
     */
    variant?: 'card' | 'plain';
    /** 展开后的教程内容。 */
    children: React.ReactNode;
}

/**
 * 手动下载教程折叠块：模型未就绪时由调用方渲染，就绪后不渲染。
 *
 * 外壳样式由 variant 决定，折叠行为与展开后的留白保持一致。
 */
export const ManualDownloadGuide = ({ title, variant = 'card', children }: ManualDownloadGuideProps) => {
    const [open, setOpen] = React.useState(false);

    const trigger = (
        <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            className={cn(
                'w-full flex items-center justify-between text-xs font-medium text-muted-foreground hover:text-foreground transition-colors',
                variant === 'card' ? 'px-3.5 py-2.5' : 'py-1',
            )}
        >
            <span className="flex items-center gap-1.5">
                <HelpCircle className="w-3.5 h-3.5" />
                {title}
            </span>
            {open ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
        </button>
    );

    if (variant === 'plain') {
        return (
            <div className="border-t border-border/50 pt-2">
                {trigger}
                {open && (
                    <div className="pt-2 space-y-3 text-xs text-muted-foreground">
                        {children}
                    </div>
                )}
            </div>
        );
    }

    return (
        <div className="rounded-xl border border-border/60 bg-muted/10 overflow-hidden">
            {trigger}
            {open && (
                <div className="p-3.5 pt-2 space-y-3.5 text-xs border-t border-border/40 text-muted-foreground">
                    {children}
                </div>
            )}
        </div>
    );
};

export default ManualDownloadGuide;
