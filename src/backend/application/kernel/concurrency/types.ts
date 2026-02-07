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
}

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

