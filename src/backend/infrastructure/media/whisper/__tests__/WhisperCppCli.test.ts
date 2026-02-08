import { EventEmitter } from 'events';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { WhisperCppCli } from '@/backend/infrastructure/media/whisper/WhisperCppCli';

const { spawnMock, runtimePathMock } = vi.hoisted(() => ({
    spawnMock: vi.fn(),
    runtimePathMock: vi.fn(),
}));

vi.mock('child_process', () => ({
    default: {
        spawn: (...args: unknown[]) => spawnMock(...args),
    },
    spawn: (...args: unknown[]) => spawnMock(...args),
}));

vi.mock('@/backend/utils/runtimeEnv', async (importOriginal) => {
    const actual = await importOriginal<typeof import('@/backend/utils/runtimeEnv')>();
    return {
        ...actual,
        getRuntimeResourcePath: (...args: unknown[]) => runtimePathMock(...args),
    };
});

vi.mock('@/backend/infrastructure/logger', () => ({
    getMainLogger: () => ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        withFocus: vi.fn(),
    }),
}));

type FakeChild = EventEmitter & {
    stdout: EventEmitter;
    stderr: EventEmitter;
    kill: ReturnType<typeof vi.fn>;
};

/**
 * 创建可控的伪子进程对象，用于模拟 whisper-cli 生命周期。
 */
function createFakeChild(): FakeChild {
    const child = new EventEmitter() as FakeChild;
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();
    child.kill = vi.fn();
    return child;
}

describe('WhisperCppCli 进程适配', () => {
    /**
     * 创建临时 whisper.cpp 目录结构与可执行文件。
     */
    const createWhisperRuntimeLayout = (opts: { platform: 'darwin' | 'linux'; arch: 'arm64' | 'x64'; executableName: string }) => {
        const base = fs.mkdtempSync(path.join(os.tmpdir(), 'whisper-runtime-'));
        const executableDir = path.join(base, opts.arch, opts.platform);
        fs.mkdirSync(executableDir, { recursive: true });
        const executablePath = path.join(executableDir, opts.executableName);
        fs.writeFileSync(executablePath, '');
        return {
            base,
            executablePath,
            cleanup: () => fs.rmSync(base, { recursive: true, force: true }),
        };
    };

    beforeEach(() => {
        vi.restoreAllMocks();
        vi.useRealTimers();
        runtimePathMock.mockReturnValue('/runtime/lib/whisper.cpp');
    });

    it('darwin 下应优先命中 whisper-cli 可执行文件', () => {
        vi.spyOn(process, 'platform', 'get').mockReturnValue('darwin');
        vi.spyOn(process, 'arch', 'get').mockReturnValue('arm64');
        const runtime = createWhisperRuntimeLayout({
            platform: 'darwin',
            arch: 'arm64',
            executableName: 'whisper-cli',
        });
        runtimePathMock.mockReturnValue(runtime.base);

        const cli = new WhisperCppCli();
        const resolved = cli.resolveExecutablePath();

        expect(resolved).toBe(runtime.executablePath);
        runtime.cleanup();
    });

    it('找不到任何可执行文件时应抛错', () => {
        vi.spyOn(process, 'platform', 'get').mockReturnValue('linux');
        vi.spyOn(process, 'arch', 'get').mockReturnValue('x64');
        const runtimeBase = fs.mkdtempSync(path.join(os.tmpdir(), 'whisper-runtime-empty-'));
        runtimePathMock.mockReturnValue(runtimeBase);

        const cli = new WhisperCppCli();
        expect(() => cli.resolveExecutablePath()).toThrow('executable not found');

        fs.rmSync(runtimeBase, { recursive: true, force: true });
    });

    it('获取 help 文本时应缓存避免重复 spawn', async () => {
        const child = createFakeChild();
        spawnMock.mockReturnValue(child);

        const cli = new WhisperCppCli();
        const firstPromise = cli.getHelpText('/runtime/whisper-cli');
        child.stdout.emit('data', Buffer.from('usage-text', 'utf8'));
        child.emit('close', 0);
        const first = await firstPromise;
        const second = await cli.getHelpText('/runtime/whisper-cli');

        expect(first).toBe('usage-text');
        expect(second).toBe('usage-text');
        expect(spawnMock).toHaveBeenCalledTimes(1);
    });

    it('run 解析到百分比时应回调进度事件', async () => {
        const child = createFakeChild();
        spawnMock.mockReturnValue(child);

        const cli = new WhisperCppCli();
        const onProgressEvent = vi.fn();

        const running = cli.run({
            executablePath: '/runtime/whisper-cli',
            args: ['-m', '/model.bin'],
            onProgressEvent,
        });

        child.stderr.emit('data', Buffer.from('progress = 0.25\n', 'utf8'));
        child.stdout.emit('data', Buffer.from('50%\n', 'utf8'));
        child.emit('close', 0);

        await running;
        expect(onProgressEvent).toHaveBeenCalled();
        expect(onProgressEvent).toHaveBeenCalledWith(expect.objectContaining({ percent: 25, heartbeat: false }));
    });

    it('长时间无真实进度时应回调心跳进度', async () => {
        vi.useFakeTimers();

        const child = createFakeChild();
        spawnMock.mockReturnValue(child);

        const cli = new WhisperCppCli();
        const onProgressEvent = vi.fn();

        const running = cli.run({
            executablePath: '/runtime/whisper-cli',
            args: ['-m', '/model.bin'],
            onProgressEvent,
        });

        await vi.advanceTimersByTimeAsync(4100);

        expect(onProgressEvent).toHaveBeenCalledWith(expect.objectContaining({
            percent: 0,
            heartbeat: true,
        }));

        child.emit('close', 0);
        await running;
    });

    it('启动前已取消时应直接失败且不触发 spawn', async () => {
        spawnMock.mockClear();

        const cli = new WhisperCppCli();

        await expect(cli.run({
            executablePath: '/runtime/whisper-cli',
            args: ['-m', '/model.bin'],
            isCancelled: () => true,
        })).rejects.toThrow('Transcription cancelled by user');

        expect(spawnMock).not.toHaveBeenCalled();
    });

    it('非零退出码时应携带 stderr 尾部信息', async () => {
        const child = createFakeChild();
        spawnMock.mockReturnValue(child);

        const cli = new WhisperCppCli();
        const running = cli.run({
            executablePath: '/runtime/whisper-cli',
            args: ['-m', '/model.bin'],
        });

        child.stderr.emit('data', Buffer.from('bad thing happened\n', 'utf8'));
        child.emit('close', 2);

        await expect(running).rejects.toThrow('bad thing happened');
    });

    it('调用 killActive 时应向当前进程发送信号', async () => {
        const child = createFakeChild();
        spawnMock.mockReturnValue(child);

        const cli = new WhisperCppCli();
        const running = cli.run({
            executablePath: '/runtime/whisper-cli',
            args: ['-m', '/model.bin'],
        });

        cli.killActive('SIGTERM');
        child.emit('close', 0);

        await running;
        expect(child.kill).toHaveBeenCalledWith('SIGTERM');
    });
});
