import { getMainLogger } from '@/backend/infrastructure/logger';

export type LOCK_KEY =
    | 'ffmpeg'
    | 'ffprobe'
    | 'whisper'

const LockConfig: Record<LOCK_KEY, { size: number }> = {
    ffmpeg: {size: 5},
    ffprobe: {size: 5},
    whisper: {size: 10}
};

/**
 * 按 key 维护并发槽位的轻量锁。
 *
 * 行为说明：
 * - size 表示同一 key 允许的最大并发数。
 * - 超出上限时后续请求进入 FIFO 等待队列。
 * - unlock 会把释放出的槽位转移给队首等待者。
 */
export default class Lock {
    private static locks: Map<LOCK_KEY, number> = new Map();
    private static waiters: Map<LOCK_KEY, (() => void)[]> = new Map();
    private static config = LockConfig;

    /**
     * 返回指定 key 的锁状态快照。
     * @param key 锁分组键。
     * @returns 当前占用数、等待数和最大并发。
     */
    public static status(key: LOCK_KEY): { locked: number; waiting: number; max: number } {
        const locked = this.locks.get(key) || 0;
        const waiting = this.waiters.get(key)?.length || 0;
        const max = this.config[key]?.size || Infinity;
        return { locked, waiting, max };
    }

    /**
     * 申请一个并发槽位；若达到上限则进入等待队列。
     * @param key 锁分组键。
     */
    public static async lock(key: LOCK_KEY): Promise<void> {
        const currentLockCount = this.locks.get(key) || 0;
        const maxLockCount = this.config[key]?.size || Infinity;

        if (currentLockCount >= maxLockCount) {
            getMainLogger('Lock').debug('lock wait', { key, currentLockCount, maxLockCount });
            return new Promise(resolve => {
                if (!this.waiters.has(key)) {
                    this.waiters.set(key, []);
                }
                const grantLockAndResolve = () => {
                    const lockCountAfterGrant = this.locks.get(key) || 0;
                    this.locks.set(key, lockCountAfterGrant + 1);
                    resolve();
                };
                this.waiters.get(key)!.push(grantLockAndResolve);
            });
        }
        this.locks.set(key, currentLockCount + 1);
    }

    /**
     * 释放一个并发槽位，并唤醒一个等待请求。
     * @param key 锁分组键。
     */
    public static unlock(key: LOCK_KEY): void {
        const currentLockCount = this.locks.get(key) || 0;
        if (currentLockCount <= 0) {
            getMainLogger('Lock').warn('unlock called without lock', { key });
            return;
        }

        if (currentLockCount > 1) {
            this.locks.set(key, currentLockCount - 1);
        } else {
            this.locks.delete(key);
        }

        if (this.waiters.has(key) && this.waiters.get(key)!.length > 0) {
            const waiters = this.waiters.get(key)!;
            const nextWaiter = waiters.shift()!;
            if (waiters.length === 0) {
                this.waiters.delete(key);
            }
            nextWaiter();
        }
    }

    /**
     * 在锁保护下执行异步回调，并在结束后自动释放。
     * @param key 锁分组键。
     * @param callback 需要在锁内执行的异步逻辑。
     * @returns 回调返回值。
     */
    public static async sync<T>(key: LOCK_KEY, callback: () => Promise<T>): Promise<T> {
        await this.lock(key);
        try {
            return await callback();
        } finally {
            this.unlock(key);
        }
    }
}

/**
 * 为异步方法添加锁保护的装饰器。
 * @param key 锁分组键。
 */
export function WaitLock(key: LOCK_KEY) {
    return function(target: unknown, propertyKey: string, descriptor: PropertyDescriptor) {
        const originalMethod = descriptor.value;
        descriptor.value = function(...args: unknown[]) {
            return Lock.sync(key, () => originalMethod.apply(this, args));
        };
        return descriptor;
    };
}
