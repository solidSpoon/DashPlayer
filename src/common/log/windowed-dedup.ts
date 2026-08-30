import { detachTimer } from '@/common/utils/detach-timer';

/** 经过窗口去重的一条事件上报。 */
export interface DedupReport {
    /** 合并键；同一键在一个窗口内只输出首条。 */
    key: string;
    /** 日志模块名，由落盘出口决定如何使用。 */
    module: string;
    /** 日志级别：可继续的现象用 warn，真实异常用 error。 */
    level: 'warn' | 'error';
    /** 事件描述。 */
    msg: string;
    /** 结构化上下文。 */
    data?: unknown;
}

/** 窗口去重器对外能力。 */
export interface WindowedDeduper {
    /** 上报一条可能被合并的事件。 */
    report(report: DedupReport): void;
    /** 清空全部在途窗口（运行时停止时调用，避免定时器补记到已卸载上下文）。 */
    clear(): void;
}

/** 单个合并键在窗口内的在途状态。 */
interface WindowState {
    /** 窗口内的首条上报，窗口结束时基于它补记。 */
    first: DedupReport;
    /** 窗口内被合并掉的重复次数。 */
    suppressedCount: number;
    /** 窗口结束的补记定时器。 */
    timer: ReturnType<typeof setTimeout>;
}

/**
 * 创建"首条落盘 + 窗口结束补记计数"的通用事件去重器。
 *
 * main 与 renderer 共用同一套合并语义，落盘出口由调用方注入；
 * 补记与首条使用同一个 `msg`，仅在 `data` 上追加 `suppressedCount` 与 `windowMs`，
 * 因此按事件名检索时首条与总量证据都在。定时器不阻塞进程退出。
 * @param options 窗口长度与落盘出口。
 * @returns 去重器。
 */
export function createWindowedDeduper(options: {
    /** 合并窗口，单位毫秒。 */
    windowMs: number;
    /** 落盘出口：首条与窗口结束的补记都会经过它。 */
    emit: (report: DedupReport) => void;
}): WindowedDeduper {
    const windows = new Map<string, WindowState>();

    function report(reported: DedupReport): void {
        const existing = windows.get(reported.key);
        if (existing) {
            existing.suppressedCount += 1;
            return;
        }

        options.emit(reported);
        const timer = setTimeout(() => {
            const state = windows.get(reported.key);
            windows.delete(reported.key);
            if (!state || state.suppressedCount === 0) {
                return;
            }
            const base = typeof state.first.data === 'object' && state.first.data !== null
                ? state.first.data as Record<string, unknown>
                : {};
            options.emit({
                ...state.first,
                data: { ...base, suppressedCount: state.suppressedCount, windowMs: options.windowMs },
            });
        }, options.windowMs);
        detachTimer(timer);
        windows.set(reported.key, { first: reported, suppressedCount: 0, timer });
    }

    function clear(): void {
        windows.forEach((state) => clearTimeout(state.timer));
        windows.clear();
    }

    return { report, clear };
}
