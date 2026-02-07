import { describe, expect, it } from 'vitest';

import { createConcurrencyKernel } from '@/backend/application/kernel/concurrency/ConcurrencyKernel';
import { LockOrderViolationError } from '@/backend/application/kernel/concurrency/types';

describe('并发内核门面', () => {
    it('应按 key 复用同一个信号量实例', () => {
        const kernel = createConcurrencyKernel();
        const first = kernel.semaphore('ffmpeg');
        const second = kernel.semaphore('ffmpeg');
        expect(first).toBe(second);
    });

    it('withSemaphore 应执行并返回结果', async () => {
        const kernel = createConcurrencyKernel();
        const value = await kernel.withSemaphore('ffmpeg', async () => 123);
        expect(value).toBe(123);
    });

    it('yieldIfNeeded 应路由到默认调度器', async () => {
        const kernel = createConcurrencyKernel({
            scheduler: {
                default: {
                    timeSliceMs: 1,
                    yieldDelayMs: 0,
                },
            },
        });
        const scheduler = kernel.scheduler();
        scheduler.beginFrame();
        await new Promise((resolve) => setTimeout(resolve, 2));
        await kernel.yieldIfNeeded();
        expect(kernel.snapshot().scheduler.default.yieldCount).toBeGreaterThanOrEqual(1);
    });

    it('snapshot 应包含已创建实例状态', async () => {
        const kernel = createConcurrencyKernel();
        await kernel.withRateLimit('gpt', async () => undefined);
        kernel.scheduler('default');
        kernel.mutex('critical');

        const snap = kernel.snapshot();
        expect(snap.rateLimiter.gpt).toBeDefined();
        expect(snap.scheduler.default).toBeDefined();
        expect(snap.mutex.critical).toBeDefined();
    });

    it('缺少配置的 key 应抛出错误', () => {
        const kernel = createConcurrencyKernel();
        expect(() => kernel.semaphore('unknown')).toThrow('未找到 semaphore 配置');
        expect(() => kernel.rateLimiter('unknown')).toThrow('未找到 rateLimiter 配置');
        expect(() => kernel.scheduler('unknown')).toThrow('未找到 scheduler 配置');
    });

    it('同调用链启用重入时应允许重复获取同一把锁', async () => {
        const kernel = createConcurrencyKernel();

        await kernel.withSemaphore('ffmpeg', async () => {
            await kernel.withSemaphore('ffmpeg', async () => {
                return;
            }, { reentrant: true });
        }, { reentrant: true });

        expect(kernel.snapshot().semaphore.ffmpeg.inUse).toBe(0);
    });

    it('锁顺序逆序获取应抛出违规错误', async () => {
        const kernel = createConcurrencyKernel();

        await expect(
            kernel.withSemaphore('whisper', async () => {
                await kernel.withSemaphore('ffmpeg', async () => {
                    return;
                });
            }),
        ).rejects.toBeInstanceOf(LockOrderViolationError);
    });
});
