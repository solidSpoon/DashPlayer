import { describe, expect, it, vi } from 'vitest';

import { createCooperativeScheduler } from '@/backend/application/kernel/concurrency/primitives/CooperativeScheduler';

describe('合作式调度器', () => {
    it('超过时间片预算时应发生让步', async () => {
        let now = 0;
        const sleeper = vi.fn(async () => {
            now += 1;
        });
        const scheduler = createCooperativeScheduler({
            name: 'yield',
            timeSliceMs: 5,
            yieldDelayMs: 0,
            clock: {
                now: () => now,
            },
            sleeper,
        });

        scheduler.beginFrame();
        now = 6;
        await scheduler.yieldIfNeeded();

        expect(sleeper).toHaveBeenCalledTimes(1);
        expect(scheduler.snapshot().yieldCount).toBe(1);
    });

    it('未超过预算时不应让步', async () => {
        let now = 0;
        const sleeper = vi.fn(async () => {});
        const scheduler = createCooperativeScheduler({
            name: 'no-yield',
            timeSliceMs: 10,
            yieldDelayMs: 0,
            clock: {
                now: () => now,
            },
            sleeper,
        });

        scheduler.beginFrame();
        now = 3;
        await scheduler.yieldIfNeeded();

        expect(sleeper).toHaveBeenCalledTimes(0);
        expect(scheduler.snapshot().yieldCount).toBe(0);
    });

    it('runChunked 在大批量输入下应完整处理并可多次让步', async () => {
        let now = 0;
        const sleeper = vi.fn(async () => {
            now += 1;
        });
        const scheduler = createCooperativeScheduler({
            name: 'chunked',
            timeSliceMs: 2,
            yieldDelayMs: 0,
            clock: {
                now: () => now,
            },
            sleeper,
        });

        const handled: number[] = [];
        await scheduler.runChunked([1, 2, 3, 4, 5], async (item) => {
            handled.push(item);
            now += 2;
        });

        expect(handled).toEqual([1, 2, 3, 4, 5]);
        expect(sleeper).toHaveBeenCalled();
    });
});
