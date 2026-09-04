import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest';
import FfmpegGatewayImpl from '@/backend/infrastructure/media/ffmpeg/FfmpegGatewayImpl';
import type { FfmpegCommandBuilder } from '@/backend/infrastructure/media/ffmpeg/FfmpegCommandBuilder';
import type { FfmpegProcessRunner } from '@/backend/infrastructure/media/ffmpeg/FfmpegProcessRunner';
import fs from 'fs';
import os from 'os';
import path from 'path';

vi.mock('@/backend/infrastructure/logger', () => ({
    getMainLogger: () => ({
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    }),
}));

vi.mock('@/backend/utils/runtimeEnv', () => ({
    getRuntimeResourcePath: (...parts: string[]) => (parts[1] === 'ffprobe' ? '/bin/ffprobe' : '/bin/ffmpeg'),
}));

/** 用真实临时文件承载输入输出路径，网关的入口校验会检查文件是否存在。 */
const workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ffmpeg-gateway-test-'));
const inputFilePath = path.join(workDir, 'in.mp4');
fs.writeFileSync(inputFilePath, 'fake-media');

afterAll(() => {
    fs.rmSync(workDir, { recursive: true, force: true });
});

/**
 * 测试依赖替身集合。
 */
interface GatewayTestDeps {
    commandBuilder: FfmpegCommandBuilder;
    startMock: ReturnType<typeof vi.fn>;
    runMock: ReturnType<typeof vi.fn>;
    cancelMock: ReturnType<typeof vi.fn>;
}

/**
 * 构建带依赖替身的网关实例。
 * @param probeStdout ffprobe 模拟返回的 stdout 文本。
 */
function createGateway(probeStdout = JSON.stringify({ format: { duration: 66.6 }, streams: [] })): {
    gateway: FfmpegGatewayImpl;
    deps: GatewayTestDeps;
} {
    const commandBuilder = {
        buildSplitVideo: vi.fn(() => ['-split']),
        buildSplitVideoByTimes: vi.fn(() => ['-split-times']),
        buildTrimVideo: vi.fn(() => ['-trim-video']),
        buildThumbnail: vi.fn(() => ['-thumbnail']),
        buildExtractSubtitle: vi.fn(() => ['-extract-sub']),
        buildSplitAudio: vi.fn(() => ['-split-audio']),
        buildToMp4: vi.fn(() => ['-to-mp4']),
        buildMkvToMp4: vi.fn(() => ['-mkv-to-mp4']),
        buildConvertToWav: vi.fn(() => ['-to-wav']),
        buildTrimAudio: vi.fn(() => ['-trim-audio']),
    } as unknown as FfmpegCommandBuilder;

    const cancelMock = vi.fn();
    const startMock = vi.fn((_request, hooks) => {
        hooks?.onProgress?.({ timeSecond: 1.2, percent: 10.8, rawLine: 'time=00:00:01.20' });
        return {
            cancel: cancelMock,
            result: Promise.resolve({
                exitCode: 0,
                stderrTail: [],
                stdoutText: '',
                durationMs: 12,
            }),
        };
    });
    const runMock = vi.fn(async () => ({
        exitCode: 0,
        stderrTail: [],
        stdoutText: probeStdout,
        durationMs: 5,
    }));

    const runner = {
        start: startMock,
        run: runMock,
    } as unknown as FfmpegProcessRunner;

    const gateway = new FfmpegGatewayImpl({
        commandBuilder,
        runner,
    });

    return {
        gateway,
        deps: {
            commandBuilder,
            startMock,
            runMock,
            cancelMock,
        },
    };
}

describe('FfmpegGatewayImpl', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('duration 应通过 ffprobe JSON 输出返回时长', async () => {
        const { gateway, deps } = createGateway();

        const duration = await gateway.duration(inputFilePath);

        expect(duration).toBe(66.6);
        expect(deps.runMock).toHaveBeenCalledTimes(1);
        expect(deps.runMock.mock.calls[0][0]).toMatchObject({
            ffmpegPath: '/bin/ffprobe',
        });
        expect(deps.runMock.mock.calls[0][0].args).toContain('-print_format');
    });

    it('duration 探测不到有效时长时应抛错而非返回 0', async () => {
        const { gateway } = createGateway(JSON.stringify({ format: {}, streams: [] }));

        await expect(gateway.duration(inputFilePath)).rejects.toThrow('无法探测媒体时长');
    });

    it('duration 输入文件不存在时应尽早抛错', async () => {
        const { gateway, deps } = createGateway();

        await expect(gateway.duration(path.join(workDir, 'missing.mp4'))).rejects.toThrow('输入文件不存在');

        expect(deps.runMock).not.toHaveBeenCalled();
    });

    it('getVideoInfo 应组装文件和流元数据', async () => {
        const { gateway } = createGateway(JSON.stringify({
            format: { duration: 10, bit_rate: '3200' },
            streams: [
                { codec_type: 'video', codec_name: 'h264' },
                { codec_type: 'audio', codec_name: 'aac' },
            ],
        }));

        const info = await gateway.getVideoInfo(inputFilePath);

        expect(info.filename).toBe('in.mp4');
        expect(info.duration).toBe(10);
        expect(info.size).toBeGreaterThan(0);
        expect(info.bitrate).toBe(3200);
        expect(info.videoCodec).toBe('h264');
        expect(info.audioCodec).toBe('aac');
    });

    it('转码命令输入文件不存在时应尽早抛错且不启动 ffmpeg', async () => {
        const { gateway, deps } = createGateway();

        await expect(gateway.splitVideo({
            inputFile: path.join(workDir, 'missing.mp4'),
            outputFile: path.join(workDir, 'out.mp4'),
            startSecond: 1,
            endSecond: 5,
        })).rejects.toThrow('输入文件不存在');

        expect(deps.startMock).not.toHaveBeenCalled();
    });

    it('转码命令输出目录不存在时应尽早抛错', async () => {
        const { gateway, deps } = createGateway();

        await expect(gateway.splitVideo({
            inputFile: inputFilePath,
            outputFile: path.join(workDir, 'missing-dir', 'out.mp4'),
            startSecond: 1,
            endSecond: 5,
        })).rejects.toThrow('输出目录不存在');

        expect(deps.startMock).not.toHaveBeenCalled();
    });

    it('splitVideo 应透传构建参数并触发 runner', async () => {
        const { gateway, deps } = createGateway();

        await gateway.splitVideo({
            inputFile: inputFilePath,
            outputFile: path.join(workDir, 'out.mp4'),
            startSecond: 1,
            endSecond: 5,
        });

        expect(deps.commandBuilder.buildSplitVideo).toHaveBeenCalledWith({
            inputFile: inputFilePath,
            outputFile: path.join(workDir, 'out.mp4'),
            startSecond: 1,
            endSecond: 5,
        });
        expect(deps.startMock).toHaveBeenCalledTimes(1);
        expect(deps.startMock.mock.calls[0][0]).toMatchObject({
            ffmpegPath: '/bin/ffmpeg',
            args: ['-split'],
        });
    });

    it('上层只传进度回调时应自动探测输入时长', async () => {
        const { gateway, deps } = createGateway();
        const onProgress = vi.fn();

        await gateway.toMp4(inputFilePath, path.join(workDir, 'out.mp4'), { onProgress });

        expect(deps.runMock).toHaveBeenCalledTimes(1);
        expect(deps.startMock.mock.calls[0][0].inputDurationSecond).toBe(66.6);
    });

    it('上层显式传入时长时应跳过探测并透传给 runner', async () => {
        const { gateway, deps } = createGateway();

        await gateway.mkvToMp4(inputFilePath, path.join(workDir, 'out.mp4'), { inputDurationSecond: 99 });

        expect(deps.runMock).not.toHaveBeenCalled();
        expect(deps.startMock.mock.calls[0][0].inputDurationSecond).toBe(99);
    });

    it('应把 runner 进度回调映射为向下取整的百分比', async () => {
        const { gateway } = createGateway();
        const onProgress = vi.fn();

        await gateway.toMp4(inputFilePath, path.join(workDir, 'out.mp4'), {
            onProgress,
            inputDurationSecond: 100,
        });

        expect(onProgress).toHaveBeenCalledWith(10);
    });

    it('应把取消函数透传给上层并触发 runner.cancel', async () => {
        const { gateway, deps } = createGateway();
        const onCancelable = vi.fn();

        await gateway.trimAudio(
            {
                inputFile: inputFilePath,
                outputFile: path.join(workDir, 'out.mp3'),
                startSecond: 1,
                endSecond: 2,
            },
            { onCancelable },
        );

        expect(onCancelable).toHaveBeenCalledTimes(1);
        const cancel = onCancelable.mock.calls[0][0] as () => void;
        cancel();
        expect(deps.cancelMock).toHaveBeenCalledTimes(1);
    });
});
