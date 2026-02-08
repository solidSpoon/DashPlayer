import {
    ConcurrencyProfiles,
    defaultConcurrencyProfiles,
    RateLimiterProfile,
    SchedulerProfile,
    SemaphoreProfile,
} from '@/backend/application/kernel/concurrency/config/ConcurrencyProfiles';
import { AsyncLocalStorage } from 'async_hooks';
import {
    CooperativeScheduler,
    createCooperativeScheduler,
} from '@/backend/application/kernel/concurrency/primitives/CooperativeScheduler';
import { createMutex, Mutex } from '@/backend/application/kernel/concurrency/primitives/Mutex';
import { createRateLimiter, RateLimiter } from '@/backend/application/kernel/concurrency/primitives/RateLimiter';
import { createSemaphore, Semaphore } from '@/backend/application/kernel/concurrency/primitives/Semaphore';
import {
    AcquireOptions,
    KernelAcquireOptions,
    LockOrderViolationError,
    Permit,
    SchedulerSnapshot,
    WaitTurnOptions,
} from '@/backend/application/kernel/concurrency/types';

type HeldLock = {
    key: string;
    order: number;
};

type ReentrantEntry = {
    depth: number;
    basePermit: Permit;
};

type ConcurrencyContext = {
    heldLocks: HeldLock[];
    reentrantPermits: Map<string, ReentrantEntry>;
};

/**
 * 并发内核对外接口。
 */
export interface ConcurrencyKernel {
    /**
     * 按 key 获取信号量实例。
     * @param key 配置键。
     * @returns 信号量实例。
     */
    semaphore(key: string): Semaphore;
    /**
     * 按 key 获取互斥锁实例。
     * @param key 配置键。
     * @returns 互斥锁实例。
     */
    mutex(key: string): Mutex;
    /**
     * 按 key 获取速率限制器实例。
     * @param key 配置键。
     * @returns 速率限制器实例。
     */
    rateLimiter(key: string): RateLimiter;
    /**
     * 按 key 获取调度器实例。
     * @param key 可选键，缺省为 default。
     * @returns 调度器实例。
     */
    scheduler(key?: string): CooperativeScheduler;
    /**
     * 在信号量保护下执行任务。
     * @param key 信号量键。
     * @param task 任务函数。
     * @param options 获取许可选项。
     */
    withSemaphore<T>(key: string, task: () => Promise<T>, options?: KernelAcquireOptions): Promise<T>;
    /**
     * 获取信号量许可。
     * @param key 信号量键。
     * @param options 获取许可选项。
     */
    acquire(key: string, options?: KernelAcquireOptions): Promise<Permit>;
    /**
     * 在互斥锁保护下执行任务。
     * @param key 互斥锁键。
     * @param task 任务函数。
     * @param options 获取许可选项。
     */
    withMutex<T>(key: string, task: () => Promise<T>, options?: AcquireOptions): Promise<T>;
    /**
     * 在速率限制保护下执行任务。
     * @param key 速率限制键。
     * @param task 任务函数。
     * @param options 等待放行选项。
     */
    withRateLimit<T>(key: string, task: () => Promise<T>, options?: WaitTurnOptions): Promise<T>;
    /**
     * 等待速率限制放行。
     * @param key 速率限制键。
     * @param options 等待放行选项。
     */
    waitTurn(key: string, options?: WaitTurnOptions): Promise<void>;
    /**
     * 对指定调度器执行一次按预算让步。
     * @param key 调度器键，缺省为 default。
     */
    yieldIfNeeded(key?: string): Promise<void>;
    /**
     * 返回所有已创建实例的快照。
     * @returns 快照信息。
     */
    snapshot(): {
        semaphore: Record<string, ReturnType<Semaphore['snapshot']>>;
        mutex: Record<string, ReturnType<Mutex['snapshot']>>;
        rateLimiter: Record<string, ReturnType<RateLimiter['snapshot']>>;
        scheduler: Record<string, SchedulerSnapshot>;
    };
}

/**
 * 创建新的并发调用链上下文。
 * @returns 并发上下文。
 */
function createConcurrencyContext(): ConcurrencyContext {
    return {
        heldLocks: [],
        reentrantPermits: new Map(),
    };
}

/**
 * 深度合并并发配置。
 * @param base 基础配置。
 * @param override 覆盖配置。
 * @returns 合并后的配置。
 */
function mergeProfiles(base: ConcurrencyProfiles, override?: Partial<ConcurrencyProfiles>): ConcurrencyProfiles {
    return {
        semaphore: {
            ...base.semaphore,
            ...(override?.semaphore ?? {}),
        },
        rateLimiter: {
            ...base.rateLimiter,
            ...(override?.rateLimiter ?? {}),
        },
        scheduler: {
            ...base.scheduler,
            ...(override?.scheduler ?? {}),
        },
    };
}

/**
 * 返回 key 的顺序值；未配置时使用稳定兜底顺序。
 * @param key 锁键。
 * @param orderMap 顺序映射。
 * @returns 顺序值。
 */
function resolveLockOrder(key: string, orderMap: Map<string, number>): number {
    const configured = orderMap.get(key);
    if (configured !== undefined) {
        return configured;
    }
    return Number.MAX_SAFE_INTEGER;
}

/**
 * 创建全局并发内核实例。
 * @param overrideProfiles 可选覆盖配置。
 * @returns 并发内核实例。
 */
export function createConcurrencyKernel(overrideProfiles?: Partial<ConcurrencyProfiles>): ConcurrencyKernel {
    const profiles = mergeProfiles(defaultConcurrencyProfiles, overrideProfiles);
    const semaphoreInstances = new Map<string, Semaphore>();
    const mutexInstances = new Map<string, Mutex>();
    const rateLimiterInstances = new Map<string, RateLimiter>();
    const schedulerInstances = new Map<string, CooperativeScheduler>();
    const contextStorage = new AsyncLocalStorage<ConcurrencyContext>();
    const semaphoreOrder = new Map<string, number>(Object.keys(profiles.semaphore)
        .sort((a, b) => a.localeCompare(b))
        .map((key, index) => [key, index]));

    /**
     * 在并发上下文中运行任务；若当前无上下文则创建隔离上下文。
     * @param task 需要执行的任务。
     * @returns 任务结果。
     */
    function runWithContext<T>(task: () => Promise<T>): Promise<T> {
        const existing = contextStorage.getStore();
        if (existing) {
            return task();
        }
        return contextStorage.run(createConcurrencyContext(), task);
    }

    /**
     * 读取当前并发上下文；若不存在则抛错。
     * @returns 当前上下文。
     */
    function getContextOrThrow(): ConcurrencyContext {
        const context = contextStorage.getStore();
        if (!context) {
            throw new Error('并发上下文不存在，请通过 withSemaphore/acquire 进入并发上下文');
        }
        return context;
    }

    /**
     * 对信号量获取执行锁顺序校验。
     * @param key 目标锁键。
     * @param options 获取选项。
     */
    function assertLockOrder(context: ConcurrencyContext, key: string, options?: KernelAcquireOptions): void {
        if (options?.skipOrderCheck) {
            return;
        }
        const order = resolveLockOrder(key, semaphoreOrder);
        const currentMaxOrder = context.heldLocks.reduce((maxValue, lock) => Math.max(maxValue, lock.order), -1);
        if (currentMaxOrder > order) {
            const heldKeys = context.heldLocks.map((lock) => lock.key).join(', ');
            throw new LockOrderViolationError(
                `锁顺序违规：尝试获取 ${key}，当前已持有 [${heldKeys}]，请按预定义顺序获取`,
            );
        }
    }

    /**
     * 在上下文中登记已持有锁。
     * @param key 锁键。
     */
    function pushHeldLock(context: ConcurrencyContext, key: string): void {
        context.heldLocks.push({
            key,
            order: resolveLockOrder(key, semaphoreOrder),
        });
    }

    /**
     * 在上下文中移除一条已持有锁记录。
     * @param key 锁键。
     */
    function popHeldLock(context: ConcurrencyContext, key: string): void {
        for (let index = context.heldLocks.length - 1; index >= 0; index--) {
            if (context.heldLocks[index].key === key) {
                context.heldLocks.splice(index, 1);
                return;
            }
        }
    }

    /**
     * 构造带上下文出栈逻辑的许可包装。
     * @param key 锁键。
     * @param permit 底层许可。
     * @returns 包装许可。
     */
    function wrapPermitWithContext(context: ConcurrencyContext, key: string, permit: Permit): Permit {
        let released = false;
        pushHeldLock(context, key);
        return {
            release: () => {
                if (released) {
                    return;
                }
                released = true;
                popHeldLock(context, key);
                permit.release();
            },
        };
    }

    /**
     * 读取信号量配置，若缺失则抛错。
     * @param key 配置键。
     * @returns 配置。
     */
    function getSemaphoreProfile(key: string): SemaphoreProfile {
        const profile = profiles.semaphore[key];
        if (!profile) {
            throw new Error(`未找到 semaphore 配置: ${key}`);
        }
        return profile;
    }

    /**
     * 读取速率限制配置，若缺失则抛错。
     * @param key 配置键。
     * @returns 配置。
     */
    function getRateLimiterProfile(key: string): RateLimiterProfile {
        const profile = profiles.rateLimiter[key];
        if (!profile) {
            throw new Error(`未找到 rateLimiter 配置: ${key}`);
        }
        return profile;
    }

    /**
     * 读取调度器配置，若缺失则抛错。
     * @param key 配置键。
     * @returns 配置。
     */
    function getSchedulerProfile(key: string): SchedulerProfile {
        const profile = profiles.scheduler[key];
        if (!profile) {
            throw new Error(`未找到 scheduler 配置: ${key}`);
        }
        return profile;
    }

    return {
        semaphore(key: string): Semaphore {
            const cached = semaphoreInstances.get(key);
            if (cached) {
                return cached;
            }
            const profile = getSemaphoreProfile(key);
            const created = createSemaphore({ capacity: profile.capacity, name: key });
            semaphoreInstances.set(key, created);
            return created;
        },

        mutex(key: string): Mutex {
            const cached = mutexInstances.get(key);
            if (cached) {
                return cached;
            }
            const created = createMutex({ name: key });
            mutexInstances.set(key, created);
            return created;
        },

        rateLimiter(key: string): RateLimiter {
            const cached = rateLimiterInstances.get(key);
            if (cached) {
                return cached;
            }
            const profile = getRateLimiterProfile(key);
            const created = createRateLimiter({
                maxRequests: profile.maxRequests,
                windowMs: profile.windowMs,
                name: key,
            });
            rateLimiterInstances.set(key, created);
            return created;
        },

        scheduler(key = 'default'): CooperativeScheduler {
            const cached = schedulerInstances.get(key);
            if (cached) {
                return cached;
            }
            const profile = getSchedulerProfile(key);
            const created = createCooperativeScheduler({
                name: key,
                timeSliceMs: profile.timeSliceMs,
                yieldDelayMs: profile.yieldDelayMs,
            });
            schedulerInstances.set(key, created);
            return created;
        },

        async withSemaphore<T>(key: string, task: () => Promise<T>, options?: KernelAcquireOptions): Promise<T> {
            return await runWithContext(async () => {
                const permit = await this.acquire(key, options);
                try {
                    return await task();
                } finally {
                    permit.release();
                }
            });
        },

        async acquire(key: string, options?: KernelAcquireOptions): Promise<Permit> {
            return await runWithContext(async () => {
                const context = getContextOrThrow();

                if (options?.reentrant) {
                    const current = context.reentrantPermits.get(key);
                    if (current) {
                        current.depth += 1;
                        pushHeldLock(context, key);
                        let released = false;
                        return {
                            release: () => {
                                if (released) {
                                    return;
                                }
                                released = true;
                                popHeldLock(context, key);
                                current.depth -= 1;
                                if (current.depth <= 0) {
                                    context.reentrantPermits.delete(key);
                                    current.basePermit.release();
                                }
                            },
                        };
                    }
                }

                assertLockOrder(context, key, options);
                const permit = await this.semaphore(key).acquire(options);
                const wrapped = wrapPermitWithContext(context, key, permit);

                if (options?.reentrant) {
                    context.reentrantPermits.set(key, {
                        depth: 1,
                        basePermit: permit,
                    });
                }

                return wrapped;
            });
        },

        withMutex<T>(key: string, task: () => Promise<T>, options?: AcquireOptions): Promise<T> {
            return this.mutex(key).runExclusive(task, options);
        },

        withRateLimit<T>(key: string, task: () => Promise<T>, options?: WaitTurnOptions): Promise<T> {
            return this.rateLimiter(key).schedule(task, options);
        },

        waitTurn(key: string, options?: WaitTurnOptions): Promise<void> {
            return this.rateLimiter(key).waitTurn(options);
        },

        async yieldIfNeeded(key = 'default'): Promise<void> {
            await this.scheduler(key).yieldIfNeeded();
        },

        snapshot() {
            const semaphore: Record<string, ReturnType<Semaphore['snapshot']>> = {};
            const mutex: Record<string, ReturnType<Mutex['snapshot']>> = {};
            const rateLimiter: Record<string, ReturnType<RateLimiter['snapshot']>> = {};
            const scheduler: Record<string, SchedulerSnapshot> = {};

            for (const [key, instance] of semaphoreInstances.entries()) {
                semaphore[key] = instance.snapshot();
            }
            for (const [key, instance] of mutexInstances.entries()) {
                mutex[key] = instance.snapshot();
            }
            for (const [key, instance] of rateLimiterInstances.entries()) {
                rateLimiter[key] = instance.snapshot();
            }
            for (const [key, instance] of schedulerInstances.entries()) {
                scheduler[key] = instance.snapshot();
            }

            return {
                semaphore,
                mutex,
                rateLimiter,
                scheduler,
            };
        },
    };
}
