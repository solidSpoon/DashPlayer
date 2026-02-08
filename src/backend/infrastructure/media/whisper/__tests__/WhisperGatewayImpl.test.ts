import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import WhisperGatewayImpl from '@/backend/infrastructure/media/whisper/WhisperGatewayImpl';
import { WhisperCppCli } from '@/backend/infrastructure/media/whisper/WhisperCppCli';

const { buildMock } = vi.hoisted(() => ({
    buildMock: vi.fn(),
}));

vi.mock('@/backend/infrastructure/media/whisper/WhisperCppArgsBuilder', () => ({
    WhisperCppArgsBuilder: {
        build: (...args: unknown[]) => buildMock(...args),
    },
}));

vi.mock('@/backend/infrastructure/logger', () => ({
    getMainLogger: () => ({
        debug: vi.fn(),
        info: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
        withFocus: vi.fn(),
    }),
}));

type FakeWhisperCppCli = {
    resolveExecutablePath: ReturnType<typeof vi.fn>;
    getHelpText: ReturnType<typeof vi.fn>;
    run: ReturnType<typeof vi.fn>;
    killActive: ReturnType<typeof vi.fn>;
};

describe('WhisperGatewayImpl 转录网关', () => {
    let fakeCli: FakeWhisperCppCli;
    let gateway: WhisperGatewayImpl;

    beforeEach(() => {
        vi.restoreAllMocks();

        fakeCli = {
            resolveExecutablePath: vi.fn().mockReturnValue('/lib/whisper-cli'),
            getHelpText: vi.fn().mockResolvedValue('usage: whisper-cli --vad'),
            run: vi.fn().mockResolvedValue(undefined),
            killActive: vi.fn(),
        };

        gateway = new WhisperGatewayImpl(fakeCli as unknown as WhisperCppCli);
    });

    it('转录成功时应返回 outSrt 并透传进度回调', async () => {
        const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'whisper-gw-'));
        const outSrt = path.join(outDir, 'whispercpp_out.srt');
        fs.writeFileSync(outSrt, 'srt');

        buildMock.mockReturnValue({
            args: ['-m', '/model.bin'],
            outPrefix: '/tmp/work/whispercpp_out',
            outSrt,
            vadSkippedBecauseUnsupported: false,
        });

        const onProgressEvent = vi.fn();
        const isCancelled = vi.fn().mockReturnValue(false);

        const result = await gateway.transcribe({
            processedAudioPath: '/tmp/input.wav',
            tempFolder: '/tmp/work',
            modelsRoot: '/models',
            modelSize: 'base',
            enableVad: true,
            vadModel: 'silero-v6.2.0',
            isCancelled,
            onProgressEvent,
        });

        expect(result.outSrt).toBe(outSrt);
        expect(result.warnings).toEqual([]);
        expect(fakeCli.run).toHaveBeenCalledTimes(1);
        expect(fakeCli.run).toHaveBeenCalledWith(expect.objectContaining({
            executablePath: '/lib/whisper-cli',
            args: ['-m', '/model.bin'],
            isCancelled,
            onProgressEvent,
        }));

        fs.rmSync(outDir, { recursive: true, force: true });
    });

    it('参数构建器标记 VAD 不支持时应返回告警码', async () => {
        const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'whisper-gw-'));
        const outSrt = path.join(outDir, 'whispercpp_out.srt');
        fs.writeFileSync(outSrt, 'srt');

        buildMock.mockReturnValue({
            args: ['-m', '/model.bin'],
            outPrefix: '/tmp/work/whispercpp_out',
            outSrt,
            vadSkippedBecauseUnsupported: true,
        });

        const result = await gateway.transcribe({
            processedAudioPath: '/tmp/input.wav',
            tempFolder: '/tmp/work',
            modelsRoot: '/models',
            modelSize: 'base',
            enableVad: true,
            vadModel: 'silero-v6.2.0',
        });

        expect(result.warnings).toEqual(['VAD_UNSUPPORTED']);

        fs.rmSync(outDir, { recursive: true, force: true });
    });

    it('输出 srt 缺失时应抛错', async () => {
        const outDir = fs.mkdtempSync(path.join(os.tmpdir(), 'whisper-gw-'));
        const outSrt = path.join(outDir, 'whispercpp_out.srt');

        buildMock.mockReturnValue({
            args: ['-m', '/model.bin'],
            outPrefix: '/tmp/work/whispercpp_out',
            outSrt,
            vadSkippedBecauseUnsupported: false,
        });

        await expect(gateway.transcribe({
            processedAudioPath: '/tmp/input.wav',
            tempFolder: '/tmp/work',
            modelsRoot: '/models',
            modelSize: 'base',
            enableVad: true,
            vadModel: 'silero-v6.2.0',
        })).rejects.toThrow('did not generate srt output');

        fs.rmSync(outDir, { recursive: true, force: true });
    });

    it('取消活跃任务时应转发到 cli', () => {
        gateway.cancelActive();
        expect(fakeCli.killActive).toHaveBeenCalledWith('SIGKILL');
    });
});
