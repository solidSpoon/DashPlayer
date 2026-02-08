import TimeUtil from '@/common/utils/TimeUtil';

/**
 * 视频裁剪参数。
 */
export interface TrimVideoArgs {
    /** 输入视频文件绝对路径。 */
    inputFile: string;
    /** 输出视频文件绝对路径。 */
    outputFile: string;
    /** 起始秒数，要求大于等于 0。 */
    startSecond: number;
    /** 结束秒数，要求严格大于 startSecond。 */
    endSecond: number;
    /** 视频编码器，默认使用 libx264。 */
    videoCodec?: string;
    /** 音频编码器，默认使用 aac。 */
    audioCodec?: string;
    /** 输出宽度；不传表示保持原始分辨率。 */
    outputWidth?: number;
    /** 恒定码率因子，值越大质量越低。 */
    crf?: number;
    /** 输出音频声道数；不传表示保持默认。 */
    audioChannels?: number;
    /** 输出音频码率，例如 64k。 */
    audioBitrate?: string;
}

/**
 * 视频切段参数。
 */
export interface SplitVideoByTimesArgs {
    /** 输入视频文件绝对路径。 */
    inputFile: string;
    /** 切段时间点列表（单位秒），要求升序。 */
    times: number[];
    /** 输出命名模板，例如 /tmp/chunk_%03d.mp4。 */
    outputPattern: string;
}

/**
 * 缩略图参数。
 */
export interface ThumbnailArgs {
    /** 输入媒体文件绝对路径。 */
    inputFile: string;
    /** 输出图片绝对路径。 */
    outputFile: string;
    /** 截图时间点，单位秒。 */
    timeSecond: number;
    /** 图片宽度；不传表示保持原始宽度。 */
    width?: number;
    /** 图片格式，仅支持 jpg 或 png。 */
    format?: 'jpg' | 'png';
    /** JPG 质量，范围 1~31，值越小质量越高。 */
    jpgQScale?: number;
}

/**
 * 字幕提取参数。
 */
export interface ExtractSubtitleArgs {
    /** 输入媒体文件绝对路径。 */
    inputFile: string;
    /** 输出字幕文件绝对路径。 */
    outputFile: string;
    /** 字幕流映射规则，例如 0:s:0? 或 0:s:m:language:eng?。 */
    mapRule: string;
    /** 输出字幕编码，默认 srt。 */
    subtitleCodec?: string;
}

/**
 * 音频分段参数。
 */
export interface SplitAudioArgs {
    /** 输入媒体文件绝对路径。 */
    inputFile: string;
    /** 分段时长，单位秒，要求大于 0。 */
    segmentSecond: number;
    /** 输出命名模板，例如 /tmp/seg_%03d.mp3。 */
    outputPattern: string;
    /** 音频编码器，默认 libmp3lame。 */
    audioCodec?: string;
    /** 音频质量参数，默认 4。 */
    qscale?: number;
}

/**
 * 音频转换为 WAV 参数。
 */
export interface ConvertToWavArgs {
    /** 输入音频文件绝对路径。 */
    inputFile: string;
    /** 输出 WAV 文件绝对路径。 */
    outputFile: string;
    /** 输出采样率，默认 16000。 */
    sampleRate?: number;
    /** 输出声道数，默认 1。 */
    channels?: number;
}

/**
 * FFmpeg 命令构建器接口。
 */
export interface FfmpegCommandBuilder {
    /**
     * 构建按起止时间分割视频命令参数。
     */
    buildSplitVideo(args: TrimVideoArgs): string[];

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
    buildThumbnail(args: ThumbnailArgs): string[];

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
    buildTrimAudio(args: {
        inputFile: string;
        outputFile: string;
        startSecond: number;
        endSecond: number;
        audioCodec?: string;
        audioBitrate?: string;
    }): string[];
}

/**
 * 默认 FFmpeg 命令构建实现。
 */
export class DefaultFfmpegCommandBuilder implements FfmpegCommandBuilder {
    /**
     * 构建按起止时间分割视频命令参数。
     */
    public buildSplitVideo(args: TrimVideoArgs): string[] {
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
    public buildThumbnail(args: ThumbnailArgs): string[] {
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
        const subtitleCodec = args.subtitleCodec ?? 'srt';
        return [
            '-y',
            '-i', args.inputFile,
            '-map', args.mapRule,
            '-c:s', subtitleCodec,
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

        const audioCodec = args.audioCodec ?? 'libmp3lame';
        const qscale = args.qscale ?? 4;
        return [
            '-y',
            '-i', args.inputFile,
            '-vn',
            '-f', 'segment',
            '-segment_time', `${args.segmentSecond}`,
            '-c:a', audioCodec,
            '-qscale:a', `${qscale}`,
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

        return [
            '-y',
            '-i', args.inputFile,
            '-vn',
            '-ar', `${sampleRate}`,
            '-ac', `${channels}`,
            '-c:a', 'pcm_s16le',
            '-f', 'wav',
            args.outputFile,
        ];
    }

    /**
     * 构建音频裁剪命令参数。
     */
    public buildTrimAudio(args: {
        inputFile: string;
        outputFile: string;
        startSecond: number;
        endSecond: number;
        audioCodec?: string;
        audioBitrate?: string;
    }): string[] {
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
