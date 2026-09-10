import React from 'react';

export interface SettingBlockHeaderProps {
    title: React.ReactNode;
    description?: React.ReactNode;
    icon?: React.ElementType;
    /** 右侧动作区，如"打开文件夹"按钮。 */
    action?: React.ReactNode;
}

/**
 * 分组卡片内的子区块标题行：左侧标题 + 说明，右侧动作。
 *
 * 只负责标题行本身，不带内边距，由调用方决定整个区块的留白。
 */
export const SettingBlockHeader = ({
    title,
    description,
    icon: Icon,
    action,
}: SettingBlockHeaderProps) => (
    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-0.5 min-w-0">
            <div className="flex items-center gap-2 text-sm font-medium text-foreground">
                {Icon && <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />}
                {title}
            </div>
            {description && (
                <p className="text-xs leading-relaxed text-muted-foreground">{description}</p>
            )}
        </div>
        {action && <div className="flex shrink-0 items-center gap-2">{action}</div>}
    </div>
);

export default SettingBlockHeader;
