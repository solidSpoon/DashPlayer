import {
    SchedulerOptions,
    SchedulerSnapshot,
    YieldOptions,
} from '@/backend/application/kernel/concurrency/types';

const defaultClock = {
    now: (): number => Date.now(),
};

/**
 * 默认 sleep 实现。
 * @param delayMs 让步时长（毫秒）。
 */
const defaultSleeper = async (delayMs: number): Promise<void> => {
    await new Promise<void>((resolve) => setTimeout(resolve, delayMs));
};

/**
 * 合作式调度器接口。
 */
export interface CooperativeScheduler {
    /**
     * 标记一轮工作起点。
     */
    beginFrame(): void;
    /**
     * 按时间片预算决定是否主动让步。
     * @param options 让步选项。
     */
    yieldIfNeeded(options?: YieldOptions): Promise<void>;
    /**
     * 逐项执行批量任务，并在执行过程中按预算让步。
     * @param items 待处理项。
     * @param worker 每项处理函数。
     */
    runChunked<T>(items: T[], worker: (item: T, index: number) => Promise<void> | void): Promise<void>;
    /**
     * 返回调度器状态快照。
     * @returns 当前状态。
     */
    snapshot(): SchedulerSnapshot;
}

/**
 * 创建合作式调度器。
 * @param options 初始化选项。
 * @returns 调度器实例。
 */
export function createCooperativeScheduler(options?: SchedulerOptions): CooperativeScheduler {
    const timeSliceMs = options?.timeSliceMs ?? 8;
    const yieldDelayMs = options?.yieldDelayMs ?? 0;
    if (!Number.isFinite(timeSliceMs) || timeSliceMs <= 0) {
        throw new Error('timeSliceMs 必须大于 0');
    }
    if (!Number.isFinite(yieldDelayMs) || yieldDelayMs < 0) {
        throw new Error('yieldDelayMs 不能小于 0');
    }

    const clock = options?.clock ?? defaultClock;
    const sleeper = options?.sleeper ?? defaultSleeper;
    const name = options?.name ?? 'default';
    let frameStartAt = clock.now();
    let yieldCount = 0;

    return {
        beginFrame(): void {
            frameStartAt = clock.now();
        },

        async yieldIfNeeded(yieldOptions?: YieldOptions): Promise<void> {
            const now = clock.now();
            const elapsedMs = now - frameStartAt;
            const shouldYield = Boolean(yieldOptions?.force) || elapsedMs >= timeSliceMs;
            if (!shouldYield) {
                return;
            }
            yieldCount += 1;
            await sleeper(yieldDelayMs);
            frameStartAt = clock.now();
        },

        async runChunked<T>(items: T[], worker: (item: T, index: number) => Promise<void> | void): Promise<void> {
            this.beginFrame();
            for (let index = 0; index < items.length; index++) {
                await worker(items[index], index);
                await this.yieldIfNeeded();
            }
        },

        snapshot(): SchedulerSnapshot {
            return {
                name,
                timeSliceMs,
                yieldDelayMs,
                frameStartAt,
                yieldCount,
            };
        },
    };
}

