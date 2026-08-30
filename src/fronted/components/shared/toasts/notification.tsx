import React from 'react';
import toast, { ToastOptions } from 'react-hot-toast';

/** 全局提示的统一视觉与去重出口：所有"系统级通知"（后端推送、跨组件错误）都经由此处展示。 */

/** 提示的语义类型。 */
export type NotificationVariant = 'default' | 'success' | 'info' | 'warning' | 'error';

/** 提示的展示参数。 */
export interface NotificationOptions {
    /** 提示标题，可选。 */
    title?: string;
    /** 提示正文。 */
    message: string;
    /** 语义类型，默认 default。 */
    variant?: NotificationVariant;
    /** 展示时长（毫秒），默认 4500。 */
    duration?: number;
    /** 合并重复提示的稳定键：同键提示在存活窗口内合并为一条并累计 (xN)。 */
    dedupeKey?: string;
    /** 直接指定提示 id；优先于 dedupeKey。 */
    id?: string;
    /** 是否使用带小尖角的气泡视觉，默认 true。 */
    bubble?: boolean;
}

/** 按提示 id 记录合并次数（存活窗口内）。 */
const countsById = new Map<string, number>();
/** 按提示 id 记录最近一次展示时间，用于过期清理。 */
const lastShownAtById = new Map<string, number>();
/** 按提示 id 记录合并窗口的截止时刻。 */
const activeUntilById = new Map<string, number>();

/** 合并阈值超过该数量时触发一次过期清理。 */
const GC_THRESHOLD = 80;
/** 超过该时间未再出现的键会被清理。 */
const GC_CUTOFF_MS = 10 * 60 * 1000;
/** 默认展示时长（毫秒）。 */
const DEFAULT_DURATION_MS = 4500;
/** 合并窗口在展示时长基础上的额外缓冲（毫秒），覆盖退出动画。 */
const DUPE_WINDOW_BUFFER_MS = 250;

/**
 * 计算提示的稳定 id：显式 id > dedupeKey > 内容哈希。
 *
 * @param options 展示参数。
 * @returns 用于去重合并的 toast id。
 */
function resolveToastId(options: NotificationOptions): string {
    if (options.id) return options.id;
    if (options.dedupeKey) return `dedupe:${options.dedupeKey}`;
    let hash = 5381;
    const basis = `${options.variant ?? 'default'}|${options.title ?? ''}|${options.message}`;
    for (let i = 0; i < basis.length; i++) {
        hash = ((hash << 5) + hash) ^ basis.charCodeAt(i);
    }
    return `msg:${(hash >>> 0).toString(36)}`;
}

/**
 * 气泡视觉的提示内容：标题 + 正文 + 合并计数。
 */
function BubbleToastContent(props: {
    title?: string;
    message: string;
    variant: NotificationVariant;
    count: number;
}) {
    const { title, message, variant, count } = props;
    const toneClass = (() => {
        switch (variant) {
            case 'success':
                return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-50';
            case 'info':
                return 'border-sky-500/30 bg-sky-500/10 text-sky-50';
            case 'warning':
                return 'border-amber-500/30 bg-amber-500/10 text-amber-50';
            case 'error':
                return 'border-red-500/30 bg-red-500/10 text-red-50';
            case 'default':
            default:
                return 'border-white/15 bg-zinc-900/90 text-zinc-50';
        }
    })();

    return (
        <div className={`relative rounded-xl border px-3 py-2 shadow-lg backdrop-blur ${toneClass}`}>
            <div className="absolute left-3 top-0 -translate-y-1/2 h-2.5 w-2.5 rotate-45 bg-inherit" />
            <div className="flex items-start gap-2">
                <div className="min-w-0">
                    {title ? <div className="text-sm font-medium leading-5">{title}</div> : null}
                    <div className="text-sm leading-5 opacity-95 break-words">{message}</div>
                </div>
                {count > 1 ? (
                    <div className="shrink-0 rounded-full bg-white/10 px-2 py-0.5 text-xs leading-4 text-white/80">
                        x{count}
                    </div>
                ) : null}
            </div>
        </div>
    );
}

/**
 * 展示一条全局提示（唯一出口）。
 *
 * 同一 id（显式 id、dedupeKey 或内容哈希）在存活窗口内重复触发时合并为一条并累计 (xN)；
 * 位置统一使用 react-hot-toast 的默认顶部居中，不再支持逐条指定。
 *
 * @param options 提示内容与展示参数。
 */
export function showNotification(options: NotificationOptions): void {
    if (!options.message) return;

    const id = resolveToastId(options);
    const variant = options.variant ?? 'default';
    const duration = options.duration ?? DEFAULT_DURATION_MS;
    const bubble = options.bubble ?? true;

    const now = Date.now();
    lastShownAtById.set(id, now);

    const activeUntil = activeUntilById.get(id) ?? 0;
    const isActive = activeUntil > now;
    const nextCount = isActive ? (countsById.get(id) ?? 0) + 1 : 1;
    countsById.set(id, nextCount);
    activeUntilById.set(id, now + duration + DUPE_WINDOW_BUFFER_MS);

    if (bubble) {
        toast.custom(
            () => (
                <BubbleToastContent
                    title={options.title}
                    message={options.message}
                    variant={variant}
                    count={nextCount}
                />
            ),
            { id, duration }
        );
    } else {
        const text = options.title ? `${options.title}: ${options.message}` : options.message;
        const config: Partial<ToastOptions> = { id, duration };
        if (variant === 'success') toast.success(text, config);
        else if (variant === 'error') toast.error(text, config);
        else toast(text, config);
    }

    if (countsById.size > GC_THRESHOLD) {
        const cutoff = now - GC_CUTOFF_MS;
        for (const [key, ts] of lastShownAtById.entries()) {
            if (ts < cutoff) {
                lastShownAtById.delete(key);
                countsById.delete(key);
                activeUntilById.delete(key);
            }
        }
    }
}
