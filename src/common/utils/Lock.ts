export type LOCK_KEY =
    | 'ffmpeg'
    | 'ffprobe'

const LockConfig: Record<LOCK_KEY, { size: number }> = {
    ffmpeg: {size: 5},
    ffprobe: {size: 5}
};

export default class Lock {
    private static locks: Map<LOCK_KEY, number> = new Map();
    private static waiters: Map<LOCK_KEY, (() => void)[]> = new Map();
    private static config = LockConfig;

    public static async lock(key: LOCK_KEY): Promise<void> {
        const currentLockCount = this.locks.get(key) || 0;
        const maxLockCount = this.config[key]?.size || Infinity;

        if (currentLockCount >= maxLockCount) {
            return new Promise(resolve => {
                if (!this.waiters.has(key)) {
                    this.waiters.set(key, []);
                }
                this.waiters.get(key)!.push(resolve);
            });
        }
        this.locks.set(key, currentLockCount + 1);
    }

    public static unlock(key: LOCK_KEY): void {
        const currentLockCount = this.locks.get(key) || 0;
        if (currentLockCount > 1) {
            this.locks.set(key, currentLockCount - 1);
        } else {
            this.locks.delete(key);
        }
        if (this.waiters.has(key) && this.waiters.get(key)!.length > 0) {
            const resolve = this.waiters.get(key)!.shift()!;
            resolve();
        }
    }

    public static async sync<T>(key: LOCK_KEY, callback: () => Promise<T>): Promise<T> {
        await this.lock(key);
        try {
            return await callback();
        } finally {
            this.unlock(key);
        }
    }
}
