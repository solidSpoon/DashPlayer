import { getRendererLogger } from '@/fronted/log/simple-logger';

/**
 * 同一异常的合并窗口（毫秒）。
 *
 * renderer 侧存在批量重复抛错的真实场景：播放器在解码故障时会高频重复同一异常，
 * 一个组件树崩溃会同时触发挂在每个子树上的 ErrorBoundary。历史上就出现过提示洪水，
 * 因此这里窗口内只落第一条，窗口结束时补记被合并的条数，既不丢证据也不制造噪声。
 */
const SUPPRESS_WINDOW_MS = 5000;

/** 单个异常键在合并窗口内的累计状态。 */
interface SuppressionState {
    /** 窗口内被合并掉的重复次数。 */
    suppressedCount: number;
    /** 窗口结束时用来补记次数的定时器。 */
    timer: number;
}

/** 按 `module + signature` 维度统计的在途合并窗口。 */
const suppressions = new Map<string, SuppressionState>();

/** 上报一条可能被合并的异常事件。 */
export interface SuppressedErrorReport {
    /** 日志模块名，与 `getRendererLogger` 一致。 */
    module: string;
    /** 合并键；相同键在窗口内只落第一条。 */
    signature: string;
    /** 日志级别。 */
    level: 'warn' | 'error';
    /** 事件描述。 */
    msg: string;
    /** 结构化上下文，交给日志出口统一脱敏与裁剪。 */
    data?: unknown;
}

/**
 * 从未知异常中取出可比较的描述文本。
 * @param error 未知异常值。
 * @returns 仅用于生成合并键的文本，不作为落盘内容。
 */
export function describeForSignature(error: unknown): string {
    if (error instanceof Error) {
        return `${error.name}: ${error.message}`;
    }
    if (typeof error === 'string') {
        return error;
    }
    return typeof error;
}

/**
 * 生成用于合并重复异常的稳定键。
 *
 * 只取 message 与首个栈帧，落盘内容仍是原始错误对象，避免为了拼键而对数据做
 * `String()` 兜底而丢失结构。
 * @param message 异常描述。
 * @param stack 异常堆栈，可缺省。
 * @returns 合并键。
 */
export function buildErrorSignature(message: string, stack?: string): string {
    const firstFrame = stack
        ?.split('\n')
        .map((line) => line.trim())
        .find((line) => line.startsWith('at '));
    return firstFrame ? `${message} :: ${firstFrame}` : message;
}

/**
 * 上报 renderer 侧异常，并在合并窗口内折叠重复项。
 *
 * 重复被折叠时不会留下逐条记录，但窗口结束会补记一条带 `suppressedCount` 的事件，
 * 因此"发生过多少次"这一证据仍然保留。
 * @param report 待上报的异常事件。
 */
export function reportSuppressedError(report: SuppressedErrorReport): void {
    const key = `${report.module}::${report.signature}`;
    const existing = suppressions.get(key);
    if (existing) {
        existing.suppressedCount += 1;
        return;
    }

    getRendererLogger(report.module)[report.level](report.msg, report.data);

    const timer = window.setTimeout(() => {
        const state = suppressions.get(key);
        suppressions.delete(key);
        if (state && state.suppressedCount > 0) {
            getRendererLogger(report.module)[report.level]('repeated error suppressed', {
                signature: report.signature,
                suppressedCount: state.suppressedCount,
                windowMs: SUPPRESS_WINDOW_MS,
            });
        }
    }, SUPPRESS_WINDOW_MS);

    suppressions.set(key, { suppressedCount: 0, timer });
}

/**
 * 清理全部在途合并窗口。
 *
 * 仅在 renderer 运行时停止时调用，避免热重载后遗留定时器补记到已卸载的上下文。
 */
export function clearSuppressedErrorWindows(): void {
    suppressions.forEach((state) => window.clearTimeout(state.timer));
    suppressions.clear();
}
