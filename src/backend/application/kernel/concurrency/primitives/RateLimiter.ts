import {
    ConcurrencyCancelledError,
    ConcurrencyTimeoutError,
    RateLimiterOptions,
    RateLimiterSnapshot,
    WaitTurnOptions,
} from '@/backend/application/kernel/concurrency/types';

type QueueWaiter = {
    resolve: () => void;
    reject: (error: Error) => void;
    cleanup: () => void;
    settled: boolean;
};

/**
 * 速率限制器接口。
 */
export interface RateLimiter {
    /**
     * 等待直到当前请求可被放行。
     * @param options 等待控制选项。
     */
    waitTurn(options?: WaitTurnOptions): Promise<void>;
    /**
     * 在速率限制保护下执行异步任务。
     * @param task 需要执行的任务。
     * @param options 等待控制选项。
     * @returns 任务返回值。
     */
    schedule<T>(task: () => Promise<T>, options?: WaitTurnOptions): Promise<T>;
    /**
     * 返回当前状态快照。
     * @returns 快照信息。
     */
    snapshot(): RateLimiterSnapshot;
}

/**
 * 创建一个具备滑动窗口与 FIFO 等待队列的速率限制器。
 * @param options 初始化配置。
 * @returns 速率限制器实例。
 */
export function createRateLimiter(options: RateLimiterOptions): RateLimiter {
    if (!Number.isInteger(options.maxRequests) || options.maxRequests <= 0) {
        throw new Error('RateLimiter maxRequests 必须是大于 0 的整数');
    }
    if (!Number.isFinite(options.windowMs) || options.windowMs <= 0) {
        throw new Error('RateLimiter windowMs 必须是大于 0 的数字');
    }

    const name = options.name ?? 'rate-limiter';
    const maxRequests = options.maxRequests;
    const windowMs = options.windowMs;
    const timestamps: number[] = [];
    const queue: QueueWaiter[] = [];
    let drainTimer: ReturnType<typeof setTimeout> | null = null;

    /**
     * 清理窗口外的历史时间戳。
     * @param now 当前时间戳。
     */
    function prune(now: number): void {
        while (timestamps.length > 0 && timestamps[0] <= now - windowMs) {
            timestamps.shift();
        }
    }

    /**
     * 检查当前窗口是否还可放行。
     * @returns 是否可放行。
     */
    function canPass(): boolean {
        return timestamps.length < maxRequests;
    }

    /**
     * 给等待项发放一次通过许可。
     * @param waiter 目标等待项。
     */
    function grant(waiter: QueueWaiter): void {
        if (waiter.settled) {
            return;
        }
        waiter.settled = true;
        waiter.cleanup();
        timestamps.push(Date.now());
        waiter.resolve();
    }

    /**
     * 移除队列中的指定等待项。
     * @param target 目标等待项。
     */
    function removeWaiter(target: QueueWaiter): void {
        const index = queue.indexOf(target);
        if (index >= 0) {
            queue.splice(index, 1);
        }
    }

    /**
     * 安排下一次队列驱动时机。
     */
    function scheduleDrain(): void {
        if (drainTimer) {
            clearTimeout(drainTimer);
            drainTimer = null;
        }
        if (queue.length === 0) {
            return;
        }

        const now = Date.now();
        prune(now);
        if (canPass()) {
            queueMicrotask(drainQueue);
            return;
        }

        const earliest = timestamps[0] + windowMs;
        const waitMs = Math.max(0, earliest - now);
        drainTimer = setTimeout(() => {
            drainTimer = null;
            drainQueue();
        }, waitMs);
    }

    /**
     * 按 FIFO 顺序驱动等待队列。
     */
    function drainQueue(): void {
        const now = Date.now();
        prune(now);

        while (queue.length > 0 && canPass()) {
            const waiter = queue.shift();
            if (!waiter || waiter.settled) {
                continue;
            }
            grant(waiter);
            prune(Date.now());
        }

        if (queue.length > 0) {
            scheduleDrain();
        }
    }

    /**
     * 统一处理等待失败。
     * @param waiter 等待项。
     * @param error 失败错误。
     */
    function failWaiter(waiter: QueueWaiter, error: Error): void {
        if (waiter.settled) {
            return;
        }
        waiter.settled = true;
        waiter.cleanup();
        removeWaiter(waiter);
        waiter.reject(error);
        scheduleDrain();
    }

    return {
        async waitTurn(waitOptions?: WaitTurnOptions): Promise<void> {
            const now = Date.now();
            prune(now);
            if (queue.length === 0 && canPass()) {
                timestamps.push(now);
                return;
            }

            return await new Promise<void>((resolve, reject) => {
                let timeoutId: ReturnType<typeof setTimeout> | undefined;
                let abortListener: (() => void) | undefined;

                const waiter: QueueWaiter = {
                    resolve,
                    reject,
                    settled: false,
                    cleanup: () => {
                        if (timeoutId) {
                            clearTimeout(timeoutId);
                            timeoutId = undefined;
                        }
                        if (abortListener && waitOptions?.signal) {
                            waitOptions.signal.removeEventListener('abort', abortListener);
                            abortListener = undefined;
                        }
                    },
                };

                if (waitOptions?.signal?.aborted) {
                    failWaiter(waiter, new ConcurrencyCancelledError(`[${name}] 等待放行已取消`));
                    return;
                }

                if (typeof waitOptions?.timeoutMs === 'number') {
                    timeoutId = setTimeout(() => {
                        failWaiter(waiter, new ConcurrencyTimeoutError(`[${name}] 等待放行超时`));
                    }, waitOptions.timeoutMs);
                }

                if (waitOptions?.signal) {
                    abortListener = () => {
                        failWaiter(waiter, new ConcurrencyCancelledError(`[${name}] 等待放行已取消`));
                    };
                    waitOptions.signal.addEventListener('abort', abortListener, { once: true });
                }

                queue.push(waiter);
                scheduleDrain();
            });
        },

        async schedule<T>(task: () => Promise<T>, waitOptions?: WaitTurnOptions): Promise<T> {
            await this.waitTurn(waitOptions);
            return await task();
        },

        snapshot(): RateLimiterSnapshot {
            prune(Date.now());
            return {
                name,
                queued: queue.length,
                recentRequests: timestamps.length,
                maxRequests,
                windowMs,
            };
        },
    };
}

