import { describe, expect, it } from 'vitest';

import {
    ConcurrencyCancelledError,
    ConcurrencyTimeoutError,
} from '@/backend/application/kernel/concurrency/types';
import { createRateLimiter } from '@/backend/application/kernel/concurrency/primitives/RateLimiter';

describe('RateLimiter', () => {
    it('窗口内请求数不应超过 maxRequests', async () => {
        const limiter = createRateLimiter({ maxRequests: 2, windowMs: 50, name: 'cap' });

        await limiter.waitTurn();
        await limiter.waitTurn();

        const start = Date.now();
        await limiter.waitTurn();
        const elapsed = Date.now() - start;

        expect(elapsed).toBeGreaterThanOrEqual(40);
    });

    it('超限请求应按 FIFO 顺序放行', async () => {
        const limiter = createRateLimiter({ maxRequests: 1, windowMs: 30, name: 'fifo' });
        const order: string[] = [];

        await limiter.waitTurn();

        const second = limiter.schedule(async () => {
            order.push('second');
        });
        const third = limiter.schedule(async () => {
            order.push('third');
        });

        await second;
        await third;

        expect(order).toEqual(['second', 'third']);
    });

    it('等待取消后应退出队列', async () => {
        const limiter = createRateLimiter({ maxRequests: 1, windowMs: 100, name: 'cancel' });
        await limiter.waitTurn();

        const controller = new AbortController();
        const waiting = limiter.waitTurn({ signal: controller.signal });
        controller.abort();

        await expect(waiting).rejects.toBeInstanceOf(ConcurrencyCancelledError);
        expect(limiter.snapshot().queued).toBe(0);
    });

    it('等待超时后应退出队列', async () => {
        const limiter = createRateLimiter({ maxRequests: 1, windowMs: 80, name: 'timeout' });
        await limiter.waitTurn();

        await expect(limiter.waitTurn({ timeoutMs: 20 })).rejects.toBeInstanceOf(ConcurrencyTimeoutError);
        expect(limiter.snapshot().queued).toBe(0);
    });

    it('schedule 任务抛错不应影响后续放行', async () => {
        const limiter = createRateLimiter({ maxRequests: 1, windowMs: 20, name: 'error' });

        await expect(limiter.schedule(async () => {
            throw new Error('boom');
        })).rejects.toThrow('boom');

        await expect(limiter.schedule(async () => 'ok')).resolves.toBe('ok');
    });
});

