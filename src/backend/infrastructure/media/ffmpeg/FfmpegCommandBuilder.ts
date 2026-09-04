import TimeUtil from '@/common/utils/TimeUtil';
import type {
    ConvertToWavArgs,
    CreateThumbnailArgs,
    ExtractSubtitleArgs,
    SplitAudioArgs,
    SplitVideoByTimesArgs,
    SplitVideoRangeArgs,
    TrimAudioArgs,
    TrimVideoArgs,
} from '@/backend/services/gateways/media/FfmpegGateway';

/**
 * FFmpeg 命令构建器接口。
 *
 * 参数类型统一从网关契约（FfmpegGateway.ts）导入，保证业务层、网关与构建器看到同一份定义。
 */
export interface FfmpegCommandBuilder {
    /**
     * 构建按起止时间分割视频命令参数。
     */
    buildSplitVideo(args: SplitVideoRangeArgs): string[];

    /**
     * 构建按时间点切段视频命令参数。
     */
    buildSplitVideoByTimes(args: SplitVideoByTimesArgs): string[];

    /**
     * 构建视频裁剪命令参数。
     */
    buildTrimVideo(args: TrimVideoArgs): string[];

    /**
     * 构建缩略图命令参数。
     */
    buildThumbnail(args: CreateThumbnailArgs): string[];

    /**
     * 构建字幕提取命令参数。
     */
    buildExtractSubtitle(args: ExtractSubtitleArgs): string[];

    /**
     * 构建音频分段命令参数。
     */
    buildSplitAudio(args: SplitAudioArgs): string[];

    /**
     * 构建转 MP4 命令参数。
     */
    buildToMp4(inputFile: string, outputFile: string): string[];

    /**
     * 构建 MKV 转 MP4 命令参数。
     */
    buildMkvToMp4(inputFile: string, outputFile: string): string[];

    /**
     * 构建音频转 WAV 命令参数。
     */
    buildConvertToWav(args: ConvertToWavArgs): string[];

    /**
     * 构建音频裁剪命令参数。
     */
    buildTrimAudio(args: TrimAudioArgs): string[];
}

/**
 * 默认 FFmpeg 命令构建实现。
 */
export class DefaultFfmpegCommandBuilder implements FfmpegCommandBuilder {
    /**
     * 构建按起止时间分割视频命令参数。
     */
    public buildSplitVideo(args: SplitVideoRangeArgs): string[] {
        this.assertRange(args.startSecond, args.endSecond, '视频分割');
        const duration = args.endSecond - args.startSecond;
        return [
            '-y',
            '-ss', TimeUtil.secondToTimeStrWithMs(args.startSecond),
            '-accurate_seek',
            '-i', args.inputFile,
            '-t', `${duration}`,
            '-codec', 'copy',
            '-avoid_negative_ts', '1',
            args.outputFile,
        ];
    }

    /**
     * 构建按时间点切段视频命令参数。
     */
    public buildSplitVideoByTimes(args: SplitVideoByTimesArgs): string[] {
        this.assertAscendingTimes(args.times, '视频时间点分段');
        return [
            '-y',
            '-i', args.inputFile,
            '-f', 'segment',
            '-segment_times', args.times.map(t => TimeUtil.secondToTimeStr(t)).join(','),
            '-c', 'copy',
            '-map', '0',
            '-reset_timestamps', '1',
            args.outputPattern,
        ];
    }

    /**
     * 构建视频裁剪命令参数。
     */
    public buildTrimVideo(args: TrimVideoArgs): string[] {
        this.assertRange(args.startSecond, args.endSecond, '视频裁剪');

        const duration = args.endSecond - args.startSecond;
        const videoCodec = args.videoCodec ?? 'libx264';
        const audioCodec = args.audioCodec ?? 'aac';
        const crf = args.crf ?? 23;

        const result: string[] = [
            '-y',
            '-ss', TimeUtil.secondToTimeStrWithMs(args.startSecond),
            '-i', args.inputFile,
            '-t', `${duration}`,
            '-c:v', videoCodec,
            '-c:a', audioCodec,
            '-crf', `${crf}`,
        ];

        if (typeof args.audioChannels === 'number' && args.audioChannels > 0) {
            result.push('-ac', `${Math.floor(args.audioChannels)}`);
        }

        if (args.audioBitrate) {
            result.push('-b:a', args.audioBitrate);
        }

        if (typeof args.outputWidth === 'number' && args.outputWidth > 0) {
            result.push('-vf', `scale=${Math.floor(args.outputWidth)}:-1`);
        }

        result.push(args.outputFile);
        return result;
    }

    /**
     * 构建缩略图命令参数。
     */
    public buildThumbnail(args: CreateThumbnailArgs): string[] {
        this.assertNonNegative(args.timeSecond, '缩略图时间点');

        const format = args.format ?? 'jpg';
        const result: string[] = [
            '-y',
            '-ss', TimeUtil.secondToTimeStrWithMs(args.timeSecond),
            '-i', args.inputFile,
            '-frames:v', '1',
        ];

        if (typeof args.width === 'number' && args.width > 0) {
            result.push('-vf', `scale=${Math.floor(args.width)}:-1`);
        }

        if (format === 'jpg') {
            const qscale = args.jpgQScale ?? 4;
            result.push('-q:v', `${qscale}`);
        }

        result.push('-f', 'image2', args.outputFile);
        return result;
    }

    /**
     * 构建字幕提取命令参数。
     */
    public buildExtractSubtitle(args: ExtractSubtitleArgs): string[] {
        return [
            '-y',
            '-i', args.inputFile,
            '-map', args.mapRule,
            '-c:s', 'srt',
            args.outputFile,
        ];
    }

    /**
     * 构建音频分段命令参数。
     */
    public buildSplitAudio(args: SplitAudioArgs): string[] {
        if (!Number.isFinite(args.segmentSecond) || args.segmentSecond <= 0) {
            throw new Error('音频分段时长必须大于 0 秒');
        }

        return [
            '-y',
            '-i', args.inputFile,
            '-vn',
            '-f', 'segment',
            '-segment_time', `${args.segmentSecond}`,
            '-c:a', 'libmp3lame',
            '-qscale:a', '4',
            args.outputPattern,
        ];
    }

    /**
     * 构建转 MP4 命令参数。
     */
    public buildToMp4(inputFile: string, outputFile: string): string[] {
        return [
            '-y',
            '-i', inputFile,
            '-c:v', 'libx264',
            '-c:a', 'aac',
            outputFile,
        ];
    }

    /**
     * 构建 MKV 转 MP4 命令参数。
     */
    public buildMkvToMp4(inputFile: string, outputFile: string): string[] {
        return [
            '-y',
            '-i', inputFile,
            '-map', '0:v:0?',
            '-map', '0:a:0?',
            '-c:v', 'copy',
            '-c:a', 'aac',
            '-movflags', '+faststart',
            outputFile,
        ];
    }

    /**
     * 构建音频转 WAV 命令参数。
     */
    public buildConvertToWav(args: ConvertToWavArgs): string[] {
        const sampleRate = args.sampleRate ?? 16000;
        const channels = args.channels ?? 1;

        const result = ['-y'];
        if (args.startSecond !== undefined || args.endSecond !== undefined) {
            if (args.startSecond === undefined || args.endSecond === undefined) {
                throw new Error('WAV 裁剪必须同时提供起止时间');
            }
            this.assertRange(args.startSecond, args.endSecond, 'WAV 裁剪');
            result.push('-ss', TimeUtil.secondToTimeStrWithMs(args.startSecond));
        }
        result.push('-i', args.inputFile);
        if (args.startSecond !== undefined && args.endSecond !== undefined) {
            result.push('-t', `${args.endSecond - args.startSecond}`);
        }
        result.push(
            '-vn',
            '-ar', `${sampleRate}`,
            '-ac', `${channels}`,
            '-c:a', 'pcm_s16le',
            '-f', 'wav',
            args.outputFile,
        );
        return result;
    }

    /**
     * 构建音频裁剪命令参数。
     */
    public buildTrimAudio(args: TrimAudioArgs): string[] {
        this.assertRange(args.startSecond, args.endSecond, '音频裁剪');
        const duration = args.endSecond - args.startSecond;
        const audioCodec = args.audioCodec ?? 'libmp3lame';
        const audioBitrate = args.audioBitrate ?? '192k';

        return [
            '-y',
            '-ss', TimeUtil.secondToTimeStrWithMs(args.startSecond),
            '-i', args.inputFile,
            '-t', `${duration}`,
            '-c:a', audioCodec,
            '-b:a', audioBitrate,
            args.outputFile,
        ];
    }

    /**
     * 校验时间区间是否合法。
     */
    private assertRange(startSecond: number, endSecond: number, label: string): void {
        this.assertNonNegative(startSecond, `${label}起始时间`);
        this.assertNonNegative(endSecond, `${label}结束时间`);
        if (endSecond <= startSecond) {
            throw new Error(`${label}结束时间必须大于起始时间`);
        }
    }

    /**
     * 校验时间值为非负数。
     */
    private assertNonNegative(value: number, label: string): void {
        if (!Number.isFinite(value) || value < 0) {
            throw new Error(`${label}必须是非负数字`);
        }
    }

    /**
     * 校验时间点数组是严格递增的正序列表。
     */
    private assertAscendingTimes(times: number[], label: string): void {
        for (let index = 0; index < times.length; index++) {
            this.assertNonNegative(times[index], `${label}时间点`);
            if (index > 0 && times[index] <= times[index - 1]) {
                throw new Error(`${label}时间点必须严格递增`);
            }
        }
    }
}
