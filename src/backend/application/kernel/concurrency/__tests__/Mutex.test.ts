import { describe, expect, it } from 'vitest';

import {
    ConcurrencyCancelledError,
} from '@/backend/application/kernel/concurrency/types';
import { createMutex } from '@/backend/application/kernel/concurrency/primitives/Mutex';

describe('Mutex', () => {
    it('同一时刻只允许一个任务进入临界区', async () => {
        const mutex = createMutex({ name: 'single' });
        let active = 0;
        let maxActive = 0;

        await Promise.all(
            Array.from({ length: 5 }).map(() => mutex.runExclusive(async () => {
                active += 1;
                maxActive = Math.max(maxActive, active);
                await new Promise((resolve) => setTimeout(resolve, 5));
                active -= 1;
            })),
        );

        expect(maxActive).toBe(1);
    });

    it('多个任务应按顺序依次执行', async () => {
        const mutex = createMutex({ name: 'order' });
        const order: number[] = [];

        await Promise.all(
            [0, 1, 2].map((index) => mutex.runExclusive(async () => {
                order.push(index);
            })),
        );

        expect(order).toEqual([0, 1, 2]);
    });

    it('取消等待不应导致死锁', async () => {
        const mutex = createMutex({ name: 'cancel' });
        const first = await mutex.acquire();
        const controller = new AbortController();
        const cancelled = mutex.acquire({ signal: controller.signal });

        controller.abort();
        await expect(cancelled).rejects.toBeInstanceOf(ConcurrencyCancelledError);

        const next = mutex.acquire();
        first.release();
        const permit = await next;
        permit.release();

        expect(mutex.snapshot().locked).toBe(false);
    });
});

