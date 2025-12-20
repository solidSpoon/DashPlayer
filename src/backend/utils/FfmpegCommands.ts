// @/backend/commands/FfmpegCommands.ts
import ffmpeg from 'fluent-ffmpeg';
import TimeUtil from '@/common/utils/TimeUtil';
import path from 'path';

export class FfmpegCommands {
    /**
     * 构建分割视频的原生命令
     */
    static buildSplitVideoArgs(inputFile: string, startSecond: number, endSecond: number, outputFile: string): string[] {
        return [
            '-y',
            '-ss', TimeUtil.secondToTimeStrWithMs(startSecond),
            '-t', (endSecond - startSecond).toString(),
            '-accurate_seek',
            '-i', inputFile,
            '-codec', 'copy',
            '-avoid_negative_ts', '1',
            outputFile
        ];
    }

    /**
     * 构建按时间点分割视频的 fluent 命令
     */
    static buildSplitVideoByTimes(inputFile: string, times: number[], outputFormat: string): ffmpeg.FfmpegCommand {
        return ffmpeg(inputFile)
            .outputOptions([
                '-f', 'segment',
                '-segment_times', times.map(t => TimeUtil.secondToTimeStr(t)).join(','),
                '-c', 'copy',
                '-map', '0',
                '-reset_timestamps', '1'
            ])
            .output(outputFormat);
    }

    /**
     * 构建 MKV 转 MP4 命令
     */
    static buildMkvToMp4(inputFile: string, outputFile: string): ffmpeg.FfmpegCommand {
        return ffmpeg(inputFile)
            .outputOptions([
                '-map', '0:v:0?',
                '-map', '0:a:0?',
                '-c:v', 'copy',
                '-c:a', 'aac',
                '-movflags', '+faststart'
            ])
            .output(outputFile);
    }

    /**
     * 构建提取字幕命令
     */
    static buildExtractSubtitles(inputFile: string, outputFile: string, en: boolean): ffmpeg.FfmpegCommand {
        const mapSrt = en ? '0:s:m:language:eng?' : '0:s:0?';
        return ffmpeg(inputFile)
            .outputOptions([
                '-map', mapSrt,
                '-c:s', 'srt'
            ])
            .output(outputFile);
    }

    /**
     * 构建分割为音频命令
     */
    static buildSplitToAudio(inputFile: string, segmentTime: number, outputFormat: string): ffmpeg.FfmpegCommand {
        return ffmpeg(inputFile)
            .outputOptions([
                '-vn',
                '-f', 'segment',
                '-segment_time', `${segmentTime}`,
                '-acodec', 'libmp3lame',
                '-qscale:a', '9'
            ])
            .output(outputFormat);
    }

    /**
     * 构建 Parakeet 音频预处理命令 (16kHz, 单声道, 16-bit PCM WAV)
     */
    static buildParakeetAudio(inputFile: string, outputFile: string): ffmpeg.FfmpegCommand {
        return ffmpeg(inputFile)
            .outputOptions([
                '-vn',                    // 禁用视频
                '-ar', '16000',           // 采样率 16kHz
                '-ac', '1',               // 单声道
                '-c:a', 'pcm_s16le',      // 16-bit PCM
                '-f', 'wav'               // WAV 格式
            ])
            .output(outputFile);
    }

    /**
     * 构建转 MP4 命令
     */
    static buildToMp4(inputFile: string, outputFile: string): ffmpeg.FfmpegCommand {
        return ffmpeg(inputFile)
            .videoCodec('libx264')
            .audioCodec('aac')
            .output(outputFile);
    }

    /**
     * 构建生成缩略图命令
     */
    static buildThumbnail(inputFile: string, outputFolder: string, outputFileName: string, time: number, options: {
        quality?: 'low' | 'medium' | 'high' | 'ultra';
        width?: number;
        format?: 'jpg' | 'png';
    } = {}): ffmpeg.FfmpegCommand {
        const outputPath = path.join(outputFolder, outputFileName);
        const { quality = 'medium', width, format = 'jpg' } = options;

        // Quality presets
        const qualitySettings = {
            low: { width: 320, jpegQuality: 80 },
            medium: { width: 640, jpegQuality: 85 },
            high: { width: 1280, jpegQuality: 90 },
            ultra: { width: 1920, jpegQuality: 95 }
        };

        const settings = qualitySettings[quality];
        const targetWidth = width || settings.width;

        let command = ffmpeg(inputFile)
            .seekInput(time)
            .frames(1)
            .size(`${targetWidth}x?`);

        if (format === 'jpg') {
            command = command.outputOptions(['-q:v', `${(100 - settings.jpegQuality) / 10}`]);
        }

        return command.output(outputPath);
    }



    /**
     * 构建裁剪视频命令
     */
    static buildTrimVideo(inputFile: string, startTime: number, endTime: number, outputFile: string): ffmpeg.FfmpegCommand {
        const duration = endTime - startTime;
        return ffmpeg(inputFile)
            .setStartTime(startTime)
            .setDuration(duration)
            .audioChannels(1)
            .videoCodec('libx265')
            .audioCodec('aac')
            .audioBitrate('64k')
            .outputOptions(['-crf', '28', '-vf', 'scale=640:-1'])
            .output(outputFile);
    }
}
