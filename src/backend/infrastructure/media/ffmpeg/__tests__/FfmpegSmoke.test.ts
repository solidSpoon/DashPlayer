import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import fs from 'fs';
import os from 'os';
import path from 'path';
import FfmpegGatewayImpl from '@/backend/infrastructure/media/ffmpeg/FfmpegGatewayImpl';
import { FfmpegProcessRunner } from '@/backend/infrastructure/media/ffmpeg/FfmpegProcessRunner';

vi.mock('@/backend/infrastructure/logger', () => ({
    getMainLogger: () => ({
        info: vi.fn(),
        debug: vi.fn(),
        warn: vi.fn(),
        error: vi.fn(),
    }),
}));

// 冒烟测试直接使用仓库 lib/ 下的真实二进制，路径解析与开发模式一致。
vi.mock('@/backend/utils/runtimeEnv', () => ({
    getRuntimeResourcePath: (...segments: string[]) => path.resolve(...segments),
}));

const ffmpegPath = path.resolve('lib', 'ffmpeg');
const ffprobePath = path.resolve('lib', 'ffprobe');
const binariesReady = fs.existsSync(ffmpegPath) && fs.existsSync(ffprobePath);

/** 用真实子进程执行一次命令；fixture 生成与产物探测共用。 */
async function exec(binaryPath: string, args: string[]): Promise<string> {
    const runner = new FfmpegProcessRunner();
    const outcome = await runner.run({ ffmpegPath: binaryPath, args });
    return outcome.stdoutText;
}

/**
 * 用 ffprobe 读取媒体元数据 JSON，用于断言产物的真实属性。
 */
async function probeJson(filePath: string): Promise<{
    format: { duration?: string };
    streams: Array<{ codec_type?: string; codec_name?: string; sample_rate?: string; channels?: number; width?: number }>;
}> {
    return JSON.parse(await exec(ffprobePath, [
        '-v', 'error',
        '-print_format', 'json',
        '-show_format',
        '-show_streams',
        filePath,
    ]));
}

describe.skipIf(!binariesReady)('ffmpeg 网关冒烟测试（真实执行）', () => {
    let gateway: FfmpegGatewayImpl;
    let workDir: string;
    let sampleVideo: string;

    beforeAll(async () => {
        workDir = fs.mkdtempSync(path.join(os.tmpdir(), 'ffmpeg-smoke-'));
        gateway = new FfmpegGatewayImpl();

        // 用虚拟源现场生成 3 秒测试视频（320x240 h264 + aac），不提交任何媒体文件进仓库。
        // GOP 设为每秒一个关键帧，保证 -c copy 的按时间点切分有落点。
        sampleVideo = path.join(workDir, 'sample.mp4');
        await exec(ffmpegPath, [
            '-y',
            '-f', 'lavfi', '-i', 'testsrc=duration=3:size=320x240:rate=15',
            '-f', 'lavfi', '-i', 'sine=frequency=440:duration=3',
            '-c:v', 'libx264', '-g', '15', '-pix_fmt', 'yuv420p',
            '-c:a', 'aac',
            '-shortest',
            sampleVideo,
        ]);
    }, 60_000);

    afterAll(() => {
        fs.rmSync(workDir, { recursive: true, force: true });
    });

    it('duration 应探测出测试视频时长约为 3 秒', async () => {
        const duration = await gateway.duration(sampleVideo);

        expect(duration).toBeGreaterThan(2.5);
        expect(duration).toBeLessThan(3.5);
    });

    it('getVideoInfo 应读出编码器与文件大小', async () => {
        const info = await gateway.getVideoInfo(sampleVideo);

        expect(info.videoCodec).toBe('h264');
        expect(info.audioCodec).toBe('aac');
        expect(info.size).toBeGreaterThan(0);
        expect(info.duration).toBeGreaterThan(2.5);
    });

    it('splitVideo 无重编码分割后产物时长应约为 1 秒', { timeout: 30_000 }, async () => {
        const outputFile = path.join(workDir, 'split.mp4');

        await gateway.splitVideo({
            inputFile: sampleVideo,
            outputFile,
            startSecond: 1,
            endSecond: 2,
        });

        const probe = await probeJson(outputFile);
        const duration = Number(probe.format.duration);
        expect(duration).toBeGreaterThan(0.7);
        expect(duration).toBeLessThan(1.3);
    });

    it('splitVideoByTimes 在 1 秒处切一刀应产出 2 段且返回实测边界', { timeout: 30_000 }, async () => {
        const outputPattern = path.join(workDir, 'chunk_%03d.mp4');

        const segments = await gateway.splitVideoByTimes({
            inputFile: sampleVideo,
            times: [1],
            outputPattern,
        });

        const chunks = fs.readdirSync(workDir).filter(file => file.startsWith('chunk_'));
        expect(chunks).toHaveLength(2);
        expect(segments).toHaveLength(2);

        // 每段返回自己的文件，边界首尾相接，且覆盖原视频约 3 秒总长。
        expect(segments[0].file).toContain('chunk_000');
        expect(segments[1].file).toContain('chunk_001');
        expect(segments[0].start).toBe(0);
        expect(segments[1].start).toBeCloseTo(segments[0].end, 1);
        expect(segments[1].end).toBeGreaterThan(2.5);
        expect(segments[1].end).toBeLessThan(3.5);
    });

    it('trimVideo 重编码裁剪后时长应约为 1 秒且按指定宽度缩放', { timeout: 60_000 }, async () => {
        const outputFile = path.join(workDir, 'trim.mp4');

        await gateway.trimVideo({
            inputFile: sampleVideo,
            outputFile,
            startSecond: 1,
            endSecond: 2,
            videoCodec: 'libx264',
            audioCodec: 'aac',
            outputWidth: 160,
            crf: 28,
            audioChannels: 1,
            audioBitrate: '64k',
        });

        const probe = await probeJson(outputFile);
        const videoStream = probe.streams.find(stream => stream.codec_type === 'video');
        expect(Number(probe.format.duration)).toBeGreaterThan(0.7);
        expect(Number(probe.format.duration)).toBeLessThan(1.3);
        expect(videoStream?.width).toBe(160);
    });

    it('trimVideo 裁剪过程中进度回调应收到 0~100 的百分比', { timeout: 60_000 }, async () => {
        const outputFile = path.join(workDir, 'trim-progress.mp4');
        const percents: number[] = [];

        await gateway.trimVideo({
            inputFile: sampleVideo,
            outputFile,
            startSecond: 0,
            endSecond: 3,
        }, {
            onProgress: (percent) => percents.push(percent),
        });

        expect(percents.length).toBeGreaterThan(0);
        for (const percent of percents) {
            expect(percent).toBeGreaterThanOrEqual(0);
            expect(percent).toBeLessThanOrEqual(100);
        }
    });

    it('createThumbnail 应产出非空 jpg 图片', { timeout: 30_000 }, async () => {
        const outputFile = path.join(workDir, 'thumb.jpg');

        await gateway.createThumbnail({
            inputFile: sampleVideo,
            outputFile,
            timeSecond: 1,
            width: 160,
            format: 'jpg',
        });

        const stat = await fs.promises.stat(outputFile);
        expect(stat.size).toBeGreaterThan(0);
    });

    it('convertToWav 裁剪转码后应为 16kHz 单声道且时长约 1 秒', { timeout: 30_000 }, async () => {
        const outputFile = path.join(workDir, 'clip.wav');

        await gateway.convertToWav({
            inputFile: sampleVideo,
            outputFile,
            sampleRate: 16000,
            channels: 1,
            startSecond: 1,
            endSecond: 2,
        });

        const probe = await probeJson(outputFile);
        const audioStream = probe.streams.find(stream => stream.codec_type === 'audio');
        expect(audioStream?.sample_rate).toBe('16000');
        expect(audioStream?.channels).toBe(1);
        expect(Number(probe.format.duration)).toBeGreaterThan(0.7);
        expect(Number(probe.format.duration)).toBeLessThan(1.3);
    });

    it('toMp4 重封装转码后应仍可探测出音视频流', { timeout: 60_000 }, async () => {
        const outputFile = path.join(workDir, 'to-mp4.mp4');

        await gateway.toMp4(sampleVideo, outputFile);

        const probe = await probeJson(outputFile);
        expect(probe.streams.some(stream => stream.codec_type === 'video')).toBe(true);
        expect(probe.streams.some(stream => stream.codec_type === 'audio')).toBe(true);
    });

    it('mkvToMp4 应把 mkv 转出含音视频流的 mp4', { timeout: 60_000 }, async () => {
        const mkvFile = path.join(workDir, 'plain.mkv');
        await exec(ffmpegPath, ['-y', '-i', sampleVideo, '-c', 'copy', mkvFile]);
        const outputFile = path.join(workDir, 'mkv-to-mp4.mp4');

        await gateway.mkvToMp4(mkvFile, outputFile);

        const probe = await probeJson(outputFile);
        expect(probe.streams.some(stream => stream.codec_type === 'video')).toBe(true);
        expect(probe.streams.some(stream => stream.codec_type === 'audio')).toBe(true);
    });

    it('extractSubtitles 应从带字幕的 mkv 中提取出 srt 文本', { timeout: 30_000 }, async () => {
        // 先把一条测试字幕混流进 mkv，作为提取输入。
        const srtFile = path.join(workDir, 'fixture.srt');
        await fs.promises.writeFile(srtFile, [
            '1',
            '00:00:00,000 --> 00:00:02,000',
            'Hello smoke test',
            '',
        ].join('\n'));
        const mkvFile = path.join(workDir, 'subtitled.mkv');
        await exec(ffmpegPath, [
            '-y',
            '-i', sampleVideo,
            '-i', srtFile,
            '-map', '0', '-map', '1',
            '-c', 'copy',
            '-c:s', 'srt',
            mkvFile,
        ]);

        const outputFile = path.join(workDir, 'extracted.srt');
        const extracted = await gateway.extractSubtitles({
            inputFile: mkvFile,
            outputFile,
            preferLanguage: 'eng',
        });

        expect(extracted).toBe(true);
        const content = await fs.promises.readFile(outputFile, 'utf8');
        expect(content).toContain('Hello smoke test');
    });

    it('extractSubtitles 在无字幕的媒体上应返回 false 且不产出文件', { timeout: 30_000 }, async () => {
        const outputFile = path.join(workDir, 'no-sub.srt');

        const extracted = await gateway.extractSubtitles({
            inputFile: sampleVideo,
            outputFile,
        });

        expect(extracted).toBe(false);
        expect(fs.existsSync(outputFile)).toBe(false);
    });
});
