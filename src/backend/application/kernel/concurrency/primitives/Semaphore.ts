import {
    AcquireOptions,
    ConcurrencyCancelledError,
    ConcurrencyTimeoutError,
    Permit,
    SemaphoreOptions,
    SemaphoreSnapshot,
} from '@/backend/application/kernel/concurrency/types';

type QueueWaiter = {
    resolve: (permit: Permit) => void;
    reject: (error: Error) => void;
    cleanup: () => void;
    settled: boolean;
};

/**
 * 信号量接口。
 */
export interface Semaphore {
    /**
     * 获取一个许可；若资源不足则进入 FIFO 等待队列。
     * @param options 等待控制选项。
     * @returns 可释放的许可句柄。
     */
    acquire(options?: AcquireOptions): Promise<Permit>;
    /**
     * 立即尝试获取许可，不阻塞等待。
     * @returns 成功时返回许可，失败返回 null。
     */
    tryAcquire(): Permit | null;
    /**
     * 在许可保护下执行异步任务，并在结束后自动释放。
     * @param task 需要执行的异步任务。
     * @param options 等待控制选项。
     * @returns 任务返回值。
     */
    runExclusive<T>(task: () => Promise<T>, options?: AcquireOptions): Promise<T>;
    /**
     * 返回当前状态快照。
     * @returns 快照信息。
     */
    snapshot(): SemaphoreSnapshot;
}

/**
 * 创建一个具备 FIFO、公平等待、可取消与可超时能力的信号量。
 * @param options 初始化选项。
 * @returns 信号量实例。
 */
export function createSemaphore(options: SemaphoreOptions): Semaphore {
    if (!Number.isInteger(options.capacity) || options.capacity <= 0) {
        throw new Error('Semaphore capacity 必须是大于 0 的整数');
    }

    const name = options.name ?? 'semaphore';
    const capacity = options.capacity;
    let inUse = 0;
    const waiters: QueueWaiter[] = [];

    /**
     * 构造幂等许可对象。
     * @returns 许可。
     */
    function createPermit(): Permit {
        let released = false;
        return {
            release: () => {
                if (released) {
                    return;
                }
                released = true;
                if (inUse > 0) {
                    inUse -= 1;
                }
                drainQueue();
            },
        };
    }

    /**
     * 按 FIFO 规则从等待队列中唤醒可执行请求。
     */
    function drainQueue(): void {
        while (inUse < capacity && waiters.length > 0) {
            const waiter = waiters.shift();
            if (!waiter || waiter.settled) {
                continue;
            }
            waiter.settled = true;
            waiter.cleanup();
            inUse += 1;
            waiter.resolve(createPermit());
        }
    }

    /**
     * 将等待项从队列中移除。
     * @param target 目标等待项。
     */
    function removeWaiter(target: QueueWaiter): void {
        const index = waiters.indexOf(target);
        if (index >= 0) {
            waiters.splice(index, 1);
        }
    }

    /**
     * 统一处理取消与超时逻辑。
     * @param waiter 当前等待项。
     * @param error 需要抛出的错误。
     */
    function settleWaiterError(waiter: QueueWaiter, error: Error): void {
        if (waiter.settled) {
            return;
        }
        waiter.settled = true;
        waiter.cleanup();
        removeWaiter(waiter);
        waiter.reject(error);
    }

    return {
        async acquire(acquireOptions?: AcquireOptions): Promise<Permit> {
            if (inUse < capacity && waiters.length === 0) {
                inUse += 1;
                return createPermit();
            }

            return await new Promise<Permit>((resolve, reject) => {
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
                        if (abortListener && acquireOptions?.signal) {
                            acquireOptions.signal.removeEventListener('abort', abortListener);
                            abortListener = undefined;
                        }
                    },
                };

                if (acquireOptions?.signal?.aborted) {
                    settleWaiterError(waiter, new ConcurrencyCancelledError(`[${name}] 获取许可已取消`));
                    return;
                }

                if (typeof acquireOptions?.timeoutMs === 'number') {
                    timeoutId = setTimeout(() => {
                        settleWaiterError(waiter, new ConcurrencyTimeoutError(`[${name}] 获取许可超时`));
                    }, acquireOptions.timeoutMs);
                }

                if (acquireOptions?.signal) {
                    abortListener = () => {
                        settleWaiterError(waiter, new ConcurrencyCancelledError(`[${name}] 获取许可已取消`));
                    };
                    acquireOptions.signal.addEventListener('abort', abortListener, { once: true });
                }

                waiters.push(waiter);
                drainQueue();
            });
        },

        tryAcquire(): Permit | null {
            if (inUse >= capacity || waiters.length > 0) {
                return null;
            }
            inUse += 1;
            return createPermit();
        },

        async runExclusive<T>(task: () => Promise<T>, acquireOptions?: AcquireOptions): Promise<T> {
            const permit = await this.acquire(acquireOptions);
            try {
                return await task();
            } finally {
                permit.release();
            }
        },

        snapshot(): SemaphoreSnapshot {
            return {
                name,
                capacity,
                inUse,
                waiting: waiters.length,
            };
        },
    };
}

