import {
    ConcurrencyProfiles,
    defaultConcurrencyProfiles,
    RateLimiterProfile,
    SchedulerProfile,
    SemaphoreProfile,
} from '@/backend/application/kernel/concurrency/config/ConcurrencyProfiles';
import {
    CooperativeScheduler,
    createCooperativeScheduler,
} from '@/backend/application/kernel/concurrency/primitives/CooperativeScheduler';
import { createMutex, Mutex } from '@/backend/application/kernel/concurrency/primitives/Mutex';
import { createRateLimiter, RateLimiter } from '@/backend/application/kernel/concurrency/primitives/RateLimiter';
import { createSemaphore, Semaphore } from '@/backend/application/kernel/concurrency/primitives/Semaphore';
import { AcquireOptions, Permit, SchedulerSnapshot, WaitTurnOptions } from '@/backend/application/kernel/concurrency/types';

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
    withSemaphore<T>(key: string, task: () => Promise<T>, options?: AcquireOptions): Promise<T>;
    /**
     * 获取信号量许可。
     * @param key 信号量键。
     * @param options 获取许可选项。
     */
    acquire(key: string, options?: AcquireOptions): Promise<Permit>;
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

        withSemaphore<T>(key: string, task: () => Promise<T>, options?: AcquireOptions): Promise<T> {
            return this.semaphore(key).runExclusive(task, options);
        },

        acquire(key: string, options?: AcquireOptions): Promise<Permit> {
            return this.semaphore(key).acquire(options);
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

