import { ReactNode } from 'react';
import { Check } from 'lucide-react';

import { cn } from '@/fronted/lib/utils';

/**
 * 视频控制条二级弹窗的统一外观。
 *
 * 倍速、训练模式、字幕轨道三处弹窗共用这里的取值：面板、行、分组标题、分隔线、提示文字。
 * 调用方只负责拼宽度与内容，不再各自写一套样式；新增弹窗也必须从这里取，
 * 否则同一控制条上又会分叉出第二种观感。
 */

/**
 * 弹窗面板：深色玻璃底，与视频控制条同族；宽度由调用方按内容拼。
 *
 * 开启保留 150ms 淡入，关闭则立即隐藏：Radix 在关闭动画播完前不会卸载浮层，
 * 而相邻的两个菜单各自持有浮层，留着淡出会让「旧菜单渐隐 + 新菜单渐显」同时在屏。
 */
export const CONTROL_POPOVER_PANEL =
    'p-2 outline-none bg-neutral-900/95 backdrop-blur-xl border border-white/15 text-white shadow-2xl rounded-2xl animate-in fade-in-0 zoom-in-95 duration-150 data-[state=closed]:invisible';

/** 弹窗内的分组标题。 */
export const CONTROL_POPOVER_LABEL = 'px-2 py-1.5 text-xs font-semibold text-neutral-400';

/** 弹窗内的分隔线：拉通到面板边缘。 */
export const CONTROL_POPOVER_SEPARATOR = '-mx-2 my-1 h-px bg-white/10';

/**
 * 弹窗底边到触发按钮顶边的间距（Radix sideOffset）。
 *
 * 控制条上的弹窗一律向上生长，必须让开宿主控制条自己上方的内容，否则会压住本条的进度条。
 * 按宿主形状取值，不要用一个数字凑两种控制条：
 * - 分层控制条（进度条一行 + 按钮一行）：按钮行上沿距面板上沿约 41px，弹窗正好落在面板之上；
 * - 单行控制条（进度条与按钮同一行）：该距离约 17px。
 */
export const CONTROL_POPOVER_OFFSET_STACKED_BAR = 44;
export const CONTROL_POPOVER_OFFSET_SINGLE_ROW_BAR = 20;

/** 行右侧的次要信息（快捷键、参数摘要）：短、等宽、压暗，过长时截断（全文挂 title）。 */
export const CONTROL_POPOVER_HINT = 'min-w-0 truncate text-[10px] font-mono text-neutral-400';

/** 行内图标：不设颜色，跟随本行文字颜色。 */
export const CONTROL_POPOVER_ICON = 'w-3.5 h-3.5 shrink-0';

const ROW_BASE =
    'flex items-center justify-between gap-2 px-2 py-1.5 rounded-lg text-xs cursor-pointer select-none transition-colors outline-none';
const ROW_EMPHASIZED = 'bg-primary/20 text-primary font-medium';
const ROW_IDLE =
    'text-neutral-300 hover:bg-white/10 hover:text-white focus-visible:bg-white/10 focus-visible:text-white';

export interface ControlPopoverRowProps {
    /** 勾选态：左侧勾选槽里出现勾；复选列表只用这个，不要再加整行底色 */
    checked?: boolean;
    /** 整行高亮：只给单选列表的当前项用（如倍速档位）。复选列表里多行同时亮会连成一块色 */
    emphasize?: boolean;
    /** 勾选槽之后的图标，尺寸用 CONTROL_POPOVER_ICON */
    icon?: ReactNode;
    label: ReactNode;
    /** 行右侧：提示文字或自定义控件；自定义控件若需拦截点击请自行包一层 */
    right?: ReactNode;
    /** 悬停原生长提示：单行放不下的补充说明放这里，别撑高行 */
    title?: string;
    /**
     * 标记「这是切侧栏译文的入口」：侧栏列表靠这个属性在点击时量位置，以便重排后把当前句放回原视觉位置。
     * 属性名与面板药丸、侧栏 chip 保持一致，三处必须同一判定。
     */
    dataSideTranslationToggle?: boolean;
    /** 点击或键盘回车/空格触发 */
    onActivate: () => void;
    className?: string;
}

/**
 * 弹窗内的一行：左侧「勾选槽 + 图标 + 标题」，右侧提示文字或自定义控件。
 *
 * 勾选槽恒定占位（非勾选行留空槽），故同一弹窗内各行的标题左边界对齐、行高一致；
 * 放不下的补充说明走 title，不要另起一行。
 *
 * @returns 弹窗内的一行。
 */
export function ControlPopoverRow({
    checked,
    emphasize,
    icon,
    label,
    right,
    title,
    dataSideTranslationToggle,
    onActivate,
    className,
}: ControlPopoverRowProps) {
    return (
        <div
            role="button"
            tabIndex={0}
            aria-pressed={checked}
            title={title}
            data-side-translation-toggle={dataSideTranslationToggle ? '' : undefined}
            onClick={onActivate}
            onKeyDown={(event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    onActivate();
                }
            }}
            className={cn(ROW_BASE, emphasize ? ROW_EMPHASIZED : ROW_IDLE, className)}
        >
            <div className="flex items-center gap-2 min-w-0">
                <span className="w-3.5 shrink-0 flex items-center justify-center">
                    {checked && <Check className="w-3.5 h-3.5 text-primary stroke-[2.5]" />}
                </span>
                {icon}
                <span className="truncate">{label}</span>
            </div>
            {right}
        </div>
    );
}
