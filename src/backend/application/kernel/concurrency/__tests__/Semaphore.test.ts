import { describe, expect, it, vi } from 'vitest';

import {
    ConcurrencyCancelledError,
    ConcurrencyTimeoutError,
} from '@/backend/application/kernel/concurrency/types';
import { createSemaphore } from '@/backend/application/kernel/concurrency/primitives/Semaphore';

describe('信号量并发控制', () => {
    it('达到并发上限后应进入等待队列并按 FIFO 唤醒', async () => {
        const semaphore = createSemaphore({ capacity: 1, name: 'fifo' });
        const first = await semaphore.acquire();

        const order: string[] = [];
        const secondTask = semaphore.runExclusive(async () => {
            order.push('second');
        });
        const thirdTask = semaphore.runExclusive(async () => {
            order.push('third');
        });

        expect(semaphore.snapshot().waiting).toBe(2);
        first.release();
        await secondTask;
        await thirdTask;

        expect(order).toEqual(['second', 'third']);
        expect(semaphore.snapshot().inUse).toBe(0);
    });

    it('等待超时后应抛出超时错误并退出队列', async () => {
        const semaphore = createSemaphore({ capacity: 1, name: 'timeout' });
        const permit = await semaphore.acquire();

        await expect(semaphore.acquire({ timeoutMs: 20 })).rejects.toBeInstanceOf(ConcurrencyTimeoutError);
        expect(semaphore.snapshot().waiting).toBe(0);

        permit.release();
    });

    it('等待被取消后应抛出取消错误并退出队列', async () => {
        const semaphore = createSemaphore({ capacity: 1, name: 'cancel' });
        const permit = await semaphore.acquire();
        const controller = new AbortController();

        const waiting = semaphore.acquire({ signal: controller.signal });
        controller.abort();

        await expect(waiting).rejects.toBeInstanceOf(ConcurrencyCancelledError);
        expect(semaphore.snapshot().waiting).toBe(0);
        permit.release();
    });

    it('runExclusive 抛错时也应自动释放许可', async () => {
        const semaphore = createSemaphore({ capacity: 1, name: 'exclusive' });

        await expect(
            semaphore.runExclusive(async () => {
                throw new Error('boom');
            }),
        ).rejects.toThrow('boom');

        expect(semaphore.snapshot().inUse).toBe(0);
    });

    it('release 重复调用应保持幂等', async () => {
        const semaphore = createSemaphore({ capacity: 1, name: 'idempotent' });
        const permit = await semaphore.acquire();

        permit.release();
        permit.release();

        expect(semaphore.snapshot().inUse).toBe(0);
    });

    it('tryAcquire 在存在等待者时不应插队', async () => {
        const semaphore = createSemaphore({ capacity: 1, name: 'no-jump' });
        const first = await semaphore.acquire();
        const waiting = semaphore.acquire();

        expect(semaphore.tryAcquire()).toBeNull();
        first.release();
        const permit = await waiting;
        permit.release();
    });

    it('等待中的请求取消后不影响后续请求推进', async () => {
        const semaphore = createSemaphore({ capacity: 1, name: 'cancel-chain' });
        const first = await semaphore.acquire();
        const controller = new AbortController();

        const cancelled = semaphore.acquire({ signal: controller.signal });
        const next = semaphore.acquire();

        controller.abort();
        await expect(cancelled).rejects.toBeInstanceOf(ConcurrencyCancelledError);

        first.release();
        const permit = await next;
        permit.release();

        expect(semaphore.snapshot().waiting).toBe(0);
    });

    it('没有等待者时释放许可不应报错', async () => {
        const semaphore = createSemaphore({ capacity: 1, name: 'safe-release' });
        const permit = await semaphore.acquire();
        permit.release();
        permit.release();

        expect(semaphore.snapshot().inUse).toBe(0);
    });

    it('快速排队场景下应稳定按先后顺序执行', async () => {
        const semaphore = createSemaphore({ capacity: 1, name: 'burst' });
        const events: number[] = [];

        const tasks = Array.from({ length: 5 }).map((_, index) => semaphore.runExclusive(async () => {
            events.push(index);
        }));

        await Promise.all(tasks);
        expect(events).toEqual([0, 1, 2, 3, 4]);
    });

    it('等待超时后应释放后续插入请求机会', async () => {
        const semaphore = createSemaphore({ capacity: 1, name: 'timeout-recover' });
        const first = await semaphore.acquire();

        await expect(semaphore.acquire({ timeoutMs: 15 })).rejects.toBeInstanceOf(ConcurrencyTimeoutError);
        const pending = semaphore.acquire();
        first.release();
        const permit = await pending;
        permit.release();

        expect(semaphore.snapshot().inUse).toBe(0);
    });

    it('runExclusive 应返回任务结果', async () => {
        const semaphore = createSemaphore({ capacity: 1, name: 'result' });
        const value = await semaphore.runExclusive(async () => 42);
        expect(value).toBe(42);
    });

    it('许可释放后应触发等待请求进入执行', async () => {
        const semaphore = createSemaphore({ capacity: 1, name: 'wake' });
        const first = await semaphore.acquire();
        const spy = vi.fn();
        const next = semaphore.runExclusive(async () => {
            spy();
        });

        first.release();
        await next;
        expect(spy).toHaveBeenCalledTimes(1);
    });
});
