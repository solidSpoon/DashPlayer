import { describe, expect, it } from 'vitest';
import { DefaultFfmpegCommandBuilder } from '@/backend/infrastructure/media/ffmpeg/FfmpegCommandBuilder';

describe('DefaultFfmpegCommandBuilder', () => {
    const builder = new DefaultFfmpegCommandBuilder();

    it('按起止时间分割视频时应生成可直接执行的参数', () => {
        const args = builder.buildSplitVideo({
            inputFile: '/input.mp4',
            outputFile: '/output.mp4',
            startSecond: 10,
            endSecond: 20,
        });

        expect(args).toContain('-accurate_seek');
        expect(args).toContain('-codec');
        expect(args).toContain('copy');
        expect(args).toContain('/input.mp4');
        expect(args[args.length - 1]).toBe('/output.mp4');
    });

    it('视频裁剪时间区间非法时应直接抛错', () => {
        expect(() => {
            builder.buildTrimVideo({
                inputFile: '/a.mp4',
                outputFile: '/b.mp4',
                startSecond: 8,
                endSecond: 8,
            });
        }).toThrow('结束时间必须大于起始时间');
    });

    it('视频切段时间点不是严格递增时应抛错', () => {
        expect(() => {
            builder.buildSplitVideoByTimes({
                inputFile: '/a.mp4',
                times: [5, 5, 10],
                outputPattern: '/tmp/chunk_%03d.mp4',
            });
        }).toThrow('时间点必须严格递增');
    });

    it('视频切段时间点出现负数时应抛错', () => {
        expect(() => {
            builder.buildSplitVideoByTimes({
                inputFile: '/a.mp4',
                times: [-1, 5, 10],
                outputPattern: '/tmp/chunk_%03d.mp4',
            });
        }).toThrow('必须是非负数字');
    });

    it('裁剪视频时应带上可选的音频参数', () => {
        const args = builder.buildTrimVideo({
            inputFile: '/in.mp4',
            outputFile: '/out.mp4',
            startSecond: 1,
            endSecond: 3,
            audioChannels: 1,
            audioBitrate: '64k',
        });

        expect(args).toContain('-ac');
        expect(args).toContain('1');
        expect(args).toContain('-b:a');
        expect(args).toContain('64k');
    });

    it('裁剪视频缩放时应取偶数高度并强制 yuv420p，避免奇数高度编码报错', () => {
        const args = builder.buildTrimVideo({
            inputFile: '/in.mp4',
            outputFile: '/out.mp4',
            startSecond: 1,
            endSecond: 3,
            outputWidth: 641,
            videoPreset: 'veryfast',
        });

        expect(args).toContain('-vf');
        expect(args).toContain('scale=641:-2');
        expect(args).toContain('-pix_fmt');
        expect(args).toContain('yuv420p');
        expect(args).toContain('-preset');
        expect(args).toContain('veryfast');
    });

    it('提取字幕时应只映射探测选定的单条字幕流', () => {
        const args = builder.buildExtractSubtitle({
            inputFile: '/in.mkv',
            outputFile: '/out.srt',
            streamIndex: 2,
        });

        expect(args).toEqual([
            '-y',
            '-i', '/in.mkv',
            '-map', '0:2',
            '-c:s', 'srt',
            '-f', 'srt',
            '/out.srt',
        ]);
    });

    it('生成 jpg 缩略图时应注入 qscale 参数', () => {
        const args = builder.buildThumbnail({
            inputFile: '/input.mp4',
            outputFile: '/thumb.jpg',
            timeSecond: 2,
            format: 'jpg',
            jpgQScale: 3,
        });

        expect(args).toContain('-q:v');
        expect(args).toContain('3');
    });

    it('生成 png 缩略图时不应注入 qscale 参数', () => {
        const args = builder.buildThumbnail({
            inputFile: '/input.mp4',
            outputFile: '/thumb.png',
            timeSecond: 2,
            format: 'png',
            jpgQScale: 3,
        });

        expect(args).not.toContain('-q:v');
    });

    it('整片重编码配方应降码率加速、限定 1080p 并强制 8bit yuv420p', () => {
        const args = builder.buildRepair({
            inputFile: '/in.mkv',
            outputFile: '/out.mp4',
            recipe: 'full-transcode',
        });

        expect(args).toEqual([
            '-y',
            '-i', '/in.mkv',
            '-map', '0:v:0',
            '-map', '0:a:0?',
            '-c:v', 'libx264',
            '-preset', 'veryfast',
            '-crf', '23',
            '-vf', 'scale=min(1920\\,iw):-2',
            '-pix_fmt', 'yuv420p',
            '-profile:v', 'high',
            '-ac', '2',
            '-c:a', 'aac',
            '-b:a', '128k',
            '-movflags', '+faststart',
            '-f', 'mp4',
            '/out.mp4',
        ]);
    });

    it('只换容器配方应原样搬运音视频流', () => {
        const args = builder.buildRepair({
            inputFile: '/in.mkv',
            outputFile: '/out.mp4',
            recipe: 'remux-copy',
        });

        expect(args).toEqual([
            '-y',
            '-i', '/in.mkv',
            '-map', '0:v:0',
            '-map', '0:a:0?',
            '-c', 'copy',
            '-movflags', '+faststart',
            '-f', 'mp4',
            '/out.mp4',
        ]);
    });

    it('视频原样、音频重编码配方应只对音频使用 AAC', () => {
        const args = builder.buildRepair({
            inputFile: '/in.mkv',
            outputFile: '/out.mp4',
            recipe: 'video-copy-audio-transcode',
        });

        expect(args).toContain('-c:v');
        expect(args).toContain('copy');
        expect(args).toContain('-c:a');
        expect(args).toContain('aac');
        expect(args).not.toContain('libx264');
    });

    it('纯音频修复应只映射第一条音轨、降为立体声并输出 m4a', () => {
        const args = builder.buildRepair({
            inputFile: '/in.mp3',
            outputFile: '/out.html5.m4a',
            recipe: 'audio-transcode',
        });

        expect(args).toEqual([
            '-y',
            '-i', '/in.mp3',
            '-map', '0:a:0',
            '-ac', '2',
            '-c:a', 'aac',
            '-b:a', '128k',
            '-movflags', '+faststart',
            // 修复产物先写临时名，扩展名无法推断封装格式，因此显式指定 m4a 对应的 ipod 封装器。
            '-f', 'ipod',
            '/out.html5.m4a',
        ]);
    });

    it('构建 wav 参数时应写入采样率与声道', () => {
        const args = builder.buildConvertToWav({
            inputFile: '/in.mp3',
            outputFile: '/out.wav',
            sampleRate: 22050,
            channels: 2,
        });

        expect(args).toContain('-ar');
        expect(args).toContain('22050');
        expect(args).toContain('-ac');
        expect(args).toContain('2');
        expect(args).toContain('pcm_s16le');
    });

    it('音频裁剪时间区间非法时应抛错', () => {
        expect(() => {
            builder.buildTrimAudio({
                inputFile: '/a.mp3',
                outputFile: '/b.mp3',
                startSecond: 10,
                endSecond: 5,
            });
        }).toThrow('结束时间必须大于起始时间');
    });
});
