/**
 * 获取并发许可时的通用选项。
 */
export interface AcquireOptions {
    /**
     * 外部取消信号；触发后应立即退出等待。
     */
    signal?: AbortSignal;
    /**
     * 最长等待时长（毫秒）；超时后应视为取消。
     */
    timeoutMs?: number;
}

/**
 * 并发内核获取许可时的扩展选项。
 */
export interface KernelAcquireOptions extends AcquireOptions {
    /**
     * 是否启用同调用链重入；启用后同 key 再次进入不会重复占用底层许可。
     */
    reentrant?: boolean;
    /**
     * 是否跳过锁顺序校验，仅用于极少数受控场景。
     */
    skipOrderCheck?: boolean;
}

/**
 * 速率限制等待时的通用选项。
 */
export interface WaitTurnOptions {
    /**
     * 外部取消信号；触发后应立即退出等待。
     */
    signal?: AbortSignal;
    /**
     * 最长等待时长（毫秒）；超时后应视为取消。
     */
    timeoutMs?: number;
}

/**
 * 并发许可句柄；调用方必须在完成后释放。
 */
export interface Permit {
    /**
     * 释放许可。
     */
    release(): void;
}

/**
 * 信号量初始化配置。
 */
export interface SemaphoreOptions {
    /**
     * 允许同时持有许可的最大数量。
     */
    capacity: number;
    /**
     * 便于调试和观测的名称。
     */
    name?: string;
    /**
     * 原语类型；互斥锁底层复用信号量实现，缺少该标记时日志无法区分"独占锁被占住"与"并发槽位打满"。
     */
    kind?: 'semaphore' | 'mutex';
    /**
     * 日志端口持有者；由组合根运行期注入，保持内核不直接依赖基础设施。
     */
    logger?: ConcurrencyLoggerRef;
}

/**
 * 信号量状态快照。
 */
export interface SemaphoreSnapshot {
    /**
     * 信号量名称。
     */
    name: string;
    /**
     * 最大并发槽位数。
     */
    capacity: number;
    /**
     * 已占用槽位数。
     */
    inUse: number;
    /**
     * 等待队列长度。
     */
    waiting: number;
}

/**
 * 速率限制器初始化配置。
 */
export interface RateLimiterOptions {
    /**
     * 时间窗口内最多允许的请求次数。
     */
    maxRequests: number;
    /**
     * 滑动窗口大小（毫秒）。
     */
    windowMs: number;
    /**
     * 便于调试和观测的名称。
     */
    name?: string;
    /**
     * 日志端口持有者；由组合根运行期注入，保持内核不直接依赖基础设施。
     */
    logger?: ConcurrencyLoggerRef;
}

/**
 * 速率限制器状态快照。
 */
export interface RateLimiterSnapshot {
    /**
     * 速率限制器名称。
     */
    name: string;
    /**
     * 等待队列长度。
     */
    queued: number;
    /**
     * 当前窗口内已放行请求数。
     */
    recentRequests: number;
    /**
     * 单窗口允许最大请求数。
     */
    maxRequests: number;
    /**
     * 窗口大小（毫秒）。
     */
    windowMs: number;
}

/**
 * 合作式调度器初始化配置。
 */
export interface SchedulerOptions {
    /**
     * 单轮预算时长（毫秒）。
     */
    timeSliceMs?: number;
    /**
     * 实际让步等待时长（毫秒）。
     */
    yieldDelayMs?: number;
    /**
     * 可注入时钟，便于测试。
     */
    clock?: {
        /**
         * 返回当前时间戳（毫秒）。
         */
        now(): number;
    };
    /**
     * 可注入 sleep 实现，便于测试。
     */
    sleeper?: (delayMs: number) => Promise<void>;
    /**
     * 调度器名称。
     */
    name?: string;
    /**
     * 日志端口持有者；由组合根运行期注入，保持内核不直接依赖基础设施。
     */
    logger?: ConcurrencyLoggerRef;
}

/**
 * 并发内核日志端口；由组合根注入，保证内核本身无外部副作用。
 */
export interface ConcurrencyLogger {
    /**
     * 记录 debug 级别日志。
     * @param msg 消息文本。
     * @param data 结构化数据。
     */
    debug(msg: string, data?: Record<string, unknown>): void;
    /**
     * 记录 warn 级别日志。
     * @param msg 消息文本。
     * @param data 结构化数据。
     */
    warn(msg: string, data?: Record<string, unknown>): void;
}

/**
 * 日志端口持有者：内核持有可变引用，支持组合根在运行期注入/更新，无需重建已创建的原语。
 */
export interface ConcurrencyLoggerRef {
    /**
     * 当前日志端口；undefined 表示关闭并发内核日志。
     */
    current: ConcurrencyLogger | undefined;
}

/**
 * 安全调用日志端口：并发原语的日志异常绝不允许影响状态流转，日志失败一律吞掉。
 * @param loggerRef 日志端口持有者。
 * @param level 日志级别。
 * @param msg 消息文本。
 * @param data 结构化数据。
 */
export function safeLog(
    loggerRef: ConcurrencyLoggerRef | undefined,
    level: 'debug' | 'warn',
    msg: string,
    data?: Record<string, unknown>,
): void {
    const logger = loggerRef?.current;
    if (!logger) {
        return;
    }
    try {
        if (level === 'debug') {
            logger.debug(msg, data);
        } else {
            logger.warn(msg, data);
        }
    } catch {
        // 日志失败不影响并发原语的状态流转。
    }
}

/** 等待超过该阈值（毫秒）时记 debug，用于观测限流/信号量竞争。 */
export const CONCURRENCY_WAIT_LOG_THRESHOLD_MS = 500;

/** 持锁超过该阈值（毫秒）时记 warn，用于定位"任务卡住把锁占死"这类无法从异常发现的故障。 */
export const CONCURRENCY_HOLD_LOG_THRESHOLD_MS = 5000;

/**
 * 合作式让步调用选项。
 */
export interface YieldOptions {
    /**
     * 强制让步，忽略预算判断。
     */
    force?: boolean;
}

/**
 * 合作式调度器快照。
 */
export interface SchedulerSnapshot {
    /**
     * 调度器名称。
     */
    name: string;
    /**
     * 单轮预算时长（毫秒）。
     */
    timeSliceMs: number;
    /**
     * 每次让步的等待时长（毫秒）。
     */
    yieldDelayMs: number;
    /**
     * 上一次 beginFrame 的起始时间戳。
     */
    frameStartAt: number;
    /**
     * 累计发生让步的次数。
     */
    yieldCount: number;
}

/**
 * 超时取消错误。
 */
export class ConcurrencyTimeoutError extends Error {
    /**
     * 构造超时错误。
     * @param message 错误描述。
     */
    public constructor(message: string) {
        super(message);
        this.name = 'ConcurrencyTimeoutError';
    }
}

/**
 * 主动取消错误。
 */
export class ConcurrencyCancelledError extends Error {
    /**
     * 构造取消错误。
     * @param message 错误描述。
     */
    public constructor(message: string) {
        super(message);
        this.name = 'ConcurrencyCancelledError';
    }
}

/**
 * 锁顺序违规错误。
 */
export class LockOrderViolationError extends Error {
    /**
     * 构造锁顺序违规错误。
     * @param message 错误描述。
     */
    public constructor(message: string) {
        super(message);
        this.name = 'LockOrderViolationError';
    }
}
