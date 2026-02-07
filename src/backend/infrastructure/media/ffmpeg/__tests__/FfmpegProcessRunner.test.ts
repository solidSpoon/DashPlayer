import { EventEmitter } from 'events';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FfmpegProcessRunner } from '@/backend/infrastructure/media/ffmpeg/FfmpegProcessRunner';

const { spawnMock } = vi.hoisted(() => ({
    spawnMock: vi.fn(),
}));

vi.mock('child_process', () => ({
    default: {
        spawn: (...args: unknown[]) => spawnMock(...args),
    },
    spawn: (...args: unknown[]) => spawnMock(...args),
}));

type FakeChild = EventEmitter & {
    stderr: EventEmitter;
    kill: ReturnType<typeof vi.fn>;
    killed: boolean;
};

/**
 * 创建一个可控的伪子进程，用于驱动 runner 单测。
 */
function createFakeChild(): FakeChild {
    const child = new EventEmitter() as FakeChild;
    child.stderr = new EventEmitter();
    child.killed = false;
    child.kill = vi.fn();
    return child;
}

describe('FfmpegProcessRunner', () => {
    beforeEach(() => {
        vi.clearAllMocks();
        vi.useRealTimers();
    });

    it('启动时应回调可读命令行并带引号', async () => {
        const child = createFakeChild();
        spawnMock.mockReturnValue(child);

        const onStart = vi.fn();
        const runner = new FfmpegProcessRunner();
        const runningTask = runner.start(
            {
                ffmpegPath: '/bin/ffmpeg',
                args: ['-i', '/tmp/in file.mp4', '/tmp/out file.mp4'],
            },
            { onStart },
        );

        child.emit('close', 0);
        await runningTask.result;

        expect(onStart).toHaveBeenCalledTimes(1);
        expect(onStart.mock.calls[0][0]).toContain('"/tmp/in file.mp4"');
        expect(onStart.mock.calls[0][0]).toContain('"/tmp/out file.mp4"');
    });

    it('收到 stderr 行时应透传 onStderrLine 回调', async () => {
        const child = createFakeChild();
        spawnMock.mockReturnValue(child);

        const onStderrLine = vi.fn();
        const runner = new FfmpegProcessRunner();
        const runningTask = runner.start(
            {
                ffmpegPath: '/ffmpeg',
                args: ['-i', '/input.mp4', '/output.mp4'],
            },
            { onStderrLine },
        );

        child.stderr.emit('data', Buffer.from('line-1\nline-2\n', 'utf8'));
        child.emit('close', 0);

        await runningTask.result;

        expect(onStderrLine).toHaveBeenCalledTimes(2);
        expect(onStderrLine).toHaveBeenNthCalledWith(1, 'line-1');
        expect(onStderrLine).toHaveBeenNthCalledWith(2, 'line-2');
    });

    it('解析到 time 字段时应回调进度百分比', async () => {
        const child = createFakeChild();
        spawnMock.mockReturnValue(child);

        const onProgress = vi.fn();
        const runner = new FfmpegProcessRunner();

        const runningTask = runner.start(
            {
                ffmpegPath: '/ffmpeg',
                args: ['-i', '/input.mp4', '/output.mp4'],
                inputDurationSecond: 100,
            },
            { onProgress },
        );

        child.stderr.emit('data', Buffer.from('frame=1 time=00:00:10.00 speed=1x\n', 'utf8'));
        child.emit('close', 0);

        await runningTask.result;

        expect(onProgress).toHaveBeenCalledTimes(1);
        expect(onProgress.mock.calls[0][0].percent).toBe(10);
    });

    it('未知总时长时进度事件不应包含 percent', async () => {
        const child = createFakeChild();
        spawnMock.mockReturnValue(child);

        const onProgress = vi.fn();
        const runner = new FfmpegProcessRunner();
        const runningTask = runner.start(
            {
                ffmpegPath: '/ffmpeg',
                args: ['-i', '/input.mp4', '/output.mp4'],
            },
            { onProgress },
        );

        child.stderr.emit('data', Buffer.from('frame=1 time=00:00:03.50 speed=1x\n', 'utf8'));
        child.emit('close', 0);

        await runningTask.result;

        expect(onProgress).toHaveBeenCalledTimes(1);
        expect(onProgress.mock.calls[0][0].percent).toBeUndefined();
        expect(onProgress.mock.calls[0][0].timeSecond).toBe(3.5);
    });

    it('取消任务时应先发 SIGTERM 再兜底 SIGKILL', () => {
        vi.useFakeTimers();

        const child = createFakeChild();
        spawnMock.mockReturnValue(child);

        const runner = new FfmpegProcessRunner();
        const runningTask = runner.start({
            ffmpegPath: '/ffmpeg',
            args: ['-i', '/input.mp4', '/output.mp4'],
        });

        runningTask.cancel();
        vi.advanceTimersByTime(1200);

        expect(child.kill).toHaveBeenNthCalledWith(1, 'SIGTERM');
        expect(child.kill).toHaveBeenNthCalledWith(2, 'SIGKILL');
    });

    it('子进程触发 error 事件时应直接失败', async () => {
        const child = createFakeChild();
        spawnMock.mockReturnValue(child);

        const runner = new FfmpegProcessRunner();
        const runningTask = runner.start({
            ffmpegPath: '/ffmpeg',
            args: ['-i', '/input.mp4', '/output.mp4'],
        });

        child.emit('error', new Error('spawn failed'));

        await expect(runningTask.result).rejects.toThrow('spawn failed');
    });

    it('非零退出码时应携带 stderr 尾部信息', async () => {
        const child = createFakeChild();
        spawnMock.mockReturnValue(child);

        const runner = new FfmpegProcessRunner();
        const runningTask = runner.start({
            ffmpegPath: '/ffmpeg',
            args: ['-i', '/input.mp4', '/output.mp4'],
        });

        child.stderr.emit('data', Buffer.from('sample stderr line\n', 'utf8'));
        child.emit('close', 1);

        await expect(runningTask.result).rejects.toThrow('sample stderr line');
    });

    it('close 事件未给出退出码时应按 -1 处理', async () => {
        const child = createFakeChild();
        spawnMock.mockReturnValue(child);

        const runner = new FfmpegProcessRunner();
        const runningTask = runner.start({
            ffmpegPath: '/ffmpeg',
            args: ['-i', '/input.mp4', '/output.mp4'],
        });

        child.emit('close', null);

        await expect(runningTask.result).rejects.toThrow('退出码 -1');
    });
});
