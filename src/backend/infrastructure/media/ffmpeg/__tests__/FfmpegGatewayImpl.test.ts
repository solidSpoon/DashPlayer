import { beforeEach, describe, expect, it, vi } from 'vitest';
import FfmpegGatewayImpl from '@/backend/infrastructure/media/ffmpeg/FfmpegGatewayImpl';
import { ProgramType } from '@/backend/application/services/LocationService';
import type { FfmpegCommandBuilder } from '@/backend/infrastructure/media/ffmpeg/FfmpegCommandBuilder';
import type { FfmpegProcessRunner } from '@/backend/infrastructure/media/ffmpeg/FfmpegProcessRunner';
import fs from 'fs';

const ffprobeMock = vi.fn();
const setFfmpegPathMock = vi.fn();
const setFfprobePathMock = vi.fn();

vi.mock('fluent-ffmpeg', () => ({
    default: {
        ffprobe: (...args: unknown[]) => ffprobeMock(...args),
        setFfmpegPath: (...args: unknown[]) => setFfmpegPathMock(...args),
        setFfprobePath: (...args: unknown[]) => setFfprobePathMock(...args),
    },
}));

vi.mock('@/backend/infrastructure/logger', () => ({
    getMainLogger: () => ({
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    }),
}));

/**
 * 测试依赖替身集合。
 */
interface GatewayTestDeps {
    locationService: { getThirdLibPath: ReturnType<typeof vi.fn> };
    commandBuilder: FfmpegCommandBuilder;
    startMock: ReturnType<typeof vi.fn>;
    cancelMock: ReturnType<typeof vi.fn>;
}

/**
 * 构建带依赖替身的网关实例。
 */
function createGateway(): { gateway: FfmpegGatewayImpl; deps: GatewayTestDeps } {
    const locationService = {
        getThirdLibPath: vi.fn((type: ProgramType) => (type === ProgramType.FFMPEG ? '/bin/ffmpeg' : '/bin/ffprobe')),
    };

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
                durationMs: 12,
            }),
        };
    });

    const runner = {
        start: startMock,
    } as unknown as FfmpegProcessRunner;

    const gateway = new FfmpegGatewayImpl(locationService as never, {
        commandBuilder,
        runner,
    });

    return {
        gateway,
        deps: {
            locationService,
            commandBuilder,
            startMock,
            cancelMock,
        },
    };
}

describe('FfmpegGatewayImpl', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it('初始化时应设置 ffmpeg 与 ffprobe 路径', () => {
        const { deps } = createGateway();

        expect(deps.locationService.getThirdLibPath).toHaveBeenCalledWith(ProgramType.FFMPEG);
        expect(deps.locationService.getThirdLibPath).toHaveBeenCalledWith(ProgramType.FFPROBE);
        expect(setFfmpegPathMock).toHaveBeenCalledWith('/bin/ffmpeg');
        expect(setFfprobePathMock).toHaveBeenCalledWith('/bin/ffprobe');
    });

    it('duration 应返回 ffprobe 时长', async () => {
        const { gateway } = createGateway();
        ffprobeMock.mockImplementation((_filePath, cb) => cb(null, { format: { duration: 66.6 } }));

        const duration = await gateway.duration('/a.mp4');

        expect(duration).toBe(66.6);
    });

    it('getVideoInfo 应组装文件和流元数据', async () => {
        const { gateway } = createGateway();
        vi.spyOn(fs.promises, 'stat').mockResolvedValue({
            size: 123,
            mtimeMs: 1000,
            ctimeMs: 900,
        } as fs.Stats);

        ffprobeMock.mockImplementation((_filePath, cb) => cb(null, {
            format: { duration: 10, bit_rate: '3200' },
            streams: [
                { codec_type: 'video', codec_name: 'h264' },
                { codec_type: 'audio', codec_name: 'aac' },
            ],
        }));

        const info = await gateway.getVideoInfo('/tmp/video.mp4');

        expect(info.filename).toBe('video.mp4');
        expect(info.duration).toBe(10);
        expect(info.size).toBe(123);
        expect(info.bitrate).toBe(3200);
        expect(info.videoCodec).toBe('h264');
        expect(info.audioCodec).toBe('aac');
    });

    it('splitVideo 应透传构建参数并触发 runner', async () => {
        const { gateway, deps } = createGateway();

        await gateway.splitVideo({
            inputFile: '/in.mp4',
            outputFile: '/out.mp4',
            startSecond: 1,
            endSecond: 5,
        });

        expect(deps.commandBuilder.buildSplitVideo).toHaveBeenCalledWith({
            inputFile: '/in.mp4',
            outputFile: '/out.mp4',
            startSecond: 1,
            endSecond: 5,
        });
        expect(deps.startMock).toHaveBeenCalledTimes(1);
        expect(deps.startMock.mock.calls[0][0]).toMatchObject({
            ffmpegPath: '/bin/ffmpeg',
            args: ['-split'],
        });
    });

    it('应把 runner 进度回调映射为向下取整的百分比', async () => {
        const { gateway } = createGateway();
        const onProgress = vi.fn();

        await gateway.toMp4('/in.mp4', '/out.mp4', { onProgress });

        expect(onProgress).toHaveBeenCalledWith(10);
    });

    it('应把取消函数透传给上层并触发 runner.cancel', async () => {
        const { gateway, deps } = createGateway();
        const onCancelable = vi.fn();

        await gateway.trimAudio(
            {
                inputFile: '/in.mp3',
                outputFile: '/out.mp3',
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

    it('应把 inputDurationSecond 透传给 runner', async () => {
        const { gateway, deps } = createGateway();

        await gateway.mkvToMp4('/in.mkv', '/out.mp4', { inputDurationSecond: 99 });

        expect(deps.startMock.mock.calls[0][0].inputDurationSecond).toBe(99);
    });
});
