import {
    AcquireOptions,
    Permit,
} from '@/backend/application/kernel/concurrency/types';
import { createSemaphore, Semaphore } from '@/backend/application/kernel/concurrency/primitives/Semaphore';

/**
 * 互斥锁接口。
 */
export interface Mutex {
    /**
     * 获取互斥锁许可。
     * @param options 等待选项。
     * @returns 许可句柄。
     */
    acquire(options?: AcquireOptions): Promise<Permit>;
    /**
     * 在互斥保护下执行任务。
     * @param task 需要执行的任务。
     * @param options 等待选项。
     * @returns 任务返回值。
     */
    runExclusive<T>(task: () => Promise<T>, options?: AcquireOptions): Promise<T>;
    /**
     * 返回互斥锁状态快照。
     * @returns 状态快照。
     */
    snapshot(): { name: string; locked: boolean; waiting: number };
}

/**
 * 创建基于信号量（容量=1）的互斥锁。
 * @param options 初始化选项。
 * @returns 互斥锁实例。
 */
export function createMutex(options?: { name?: string }): Mutex {
    const name = options?.name ?? 'mutex';
    const semaphore: Semaphore = createSemaphore({
        capacity: 1,
        name,
    });

    return {
        acquire: (acquireOptions?: AcquireOptions): Promise<Permit> => semaphore.acquire(acquireOptions),
        runExclusive: <T>(task: () => Promise<T>, acquireOptions?: AcquireOptions): Promise<T> => {
            return semaphore.runExclusive(task, acquireOptions);
        },
        snapshot: () => {
            const state = semaphore.snapshot();
            return {
                name,
                locked: state.inUse > 0,
                waiting: state.waiting,
            };
        },
    };
}

