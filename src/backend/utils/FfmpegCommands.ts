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
                '-map', '0:v',
                '-map', '0:a',
                '-c:v', 'copy',
                '-c:a', 'aac',
                '-ac', '1'
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
    static buildThumbnail(inputFile: string, outputFolder: string, outputFileName: string, time: number): ffmpeg.FfmpegCommand {
        const timeStr = TimeUtil.secondToTimeStr(time);
        return ffmpeg(inputFile).screenshots({
            timestamps: [timeStr],
            filename: outputFileName,
            folder: outputFolder,
            size: '320x?'
        });
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
