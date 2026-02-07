import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/backend/infrastructure/logger', () => {
    return {
        getMainLogger: () => ({
            debug: vi.fn(),
            warn: vi.fn(),
            info: vi.fn(),
            error: vi.fn(),
        }),
    };
});

let Lock: typeof import('@/common/utils/Lock').default;

/**
 * 清理 Lock 单例中的运行时状态，避免测试间相互污染。
 */
function resetLockState(): void {
    (Lock as unknown as { locks: Map<string, number> }).locks.clear();
    (Lock as unknown as { waiters: Map<string, Array<() => void>> }).waiters.clear();
}

describe('Lock 并发控制', () => {
    beforeAll(async () => {
        ({ default: Lock } = await import('@/common/utils/Lock'));
    });

    beforeEach(() => {
        resetLockState();
    });

    it('等待任务被唤醒后应正确占用并发槽位', async () => {
        await Promise.all([
            Lock.lock('ffmpeg'),
            Lock.lock('ffmpeg'),
            Lock.lock('ffmpeg'),
            Lock.lock('ffmpeg'),
            Lock.lock('ffmpeg'),
        ]);

        const waitingLockPromise = Lock.lock('ffmpeg');
        expect(Lock.status('ffmpeg')).toEqual({
            locked: 5,
            waiting: 1,
            max: 5,
        });

        Lock.unlock('ffmpeg');
        await waitingLockPromise;

        expect(Lock.status('ffmpeg')).toEqual({
            locked: 5,
            waiting: 0,
            max: 5,
        });

        for (let i = 0; i < 5; i++) {
            Lock.unlock('ffmpeg');
        }

        expect(Lock.status('ffmpeg')).toEqual({
            locked: 0,
            waiting: 0,
            max: 5,
        });
    });

    it('重复释放不应导致计数出现负值', () => {
        Lock.unlock('ffprobe');
        Lock.unlock('ffprobe');

        expect(Lock.status('ffprobe')).toEqual({
            locked: 0,
            waiting: 0,
            max: 5,
        });
    });
});
