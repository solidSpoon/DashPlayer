import { VideoInfo } from '@/common/types/video-info';

/**
 * FFmpeg 任务可选执行参数。
 */
export interface FfmpegRunOptions {
    /** 进度回调，范围 0~100。 */
    onProgress?: (progress: number) => void;
    /** 输入媒体时长，单位秒；用于估算进度。 */
    inputDurationSecond?: number;
    /** 任务启动后回调取消函数。 */
    onCancelable?: (cancel: () => void) => void;
}

/**
 * 按起止时间分割视频参数。
 */
export interface SplitVideoRangeArgs {
    /** 输入视频文件路径。 */
    inputFile: string;
    /** 起始时间（秒）。 */
    startSecond: number;
    /** 结束时间（秒）。 */
    endSecond: number;
    /** 输出视频文件路径。 */
    outputFile: string;
}

/**
 * 按时间点切段视频参数。
 */
export interface SplitVideoByTimesArgs {
    /** 输入视频文件路径。 */
    inputFile: string;
    /** 切段时间点（秒，严格递增）。 */
    times: number[];
    /** 输出路径模板，如 /tmp/chunk_%03d.mp4。 */
    outputPattern: string;
}

/**
 * 生成缩略图参数。
 */
export interface CreateThumbnailArgs {
    /** 输入媒体文件路径。 */
    inputFile: string;
    /** 输出图片文件路径。 */
    outputFile: string;
    /** 截图时间点（秒）。 */
    timeSecond: number;
    /** 目标宽度。 */
    width?: number;
    /** 图片格式。 */
    format?: 'jpg' | 'png';
    /** jpg 质量参数（1~31，越小越清晰）。 */
    jpgQScale?: number;
}

/**
 * 分段音频参数。
 */
export interface SplitAudioArgs {
    /** 输入媒体文件路径。 */
    inputFile: string;
    /** 每段时长（秒）。 */
    segmentSecond: number;
    /** 输出路径模板。 */
    outputPattern: string;
}

/**
 * 提取字幕参数。
 */
export interface ExtractSubtitleArgs {
    /** 输入媒体文件路径。 */
    inputFile: string;
    /** 输出字幕文件路径。 */
    outputFile: string;
    /** 字幕流映射规则。 */
    mapRule: string;
}

/**
 * 裁剪视频参数。
 */
export interface TrimVideoArgs {
    /** 输入视频文件路径。 */
    inputFile: string;
    /** 输出视频文件路径。 */
    outputFile: string;
    /** 起始时间（秒）。 */
    startSecond: number;
    /** 结束时间（秒）。 */
    endSecond: number;
    /** 视频编码器。 */
    videoCodec?: string;
    /** 音频编码器。 */
    audioCodec?: string;
    /** 输出宽度。 */
    outputWidth?: number;
    /** 视频 crf 参数。 */
    crf?: number;
    /** 音频声道。 */
    audioChannels?: number;
    /** 音频码率。 */
    audioBitrate?: string;
}

/**
 * 音频裁剪参数。
 */
export interface TrimAudioArgs {
    /** 输入音频文件路径。 */
    inputFile: string;
    /** 输出音频文件路径。 */
    outputFile: string;
    /** 起始时间（秒）。 */
    startSecond: number;
    /** 结束时间（秒）。 */
    endSecond: number;
    /** 音频编码器。 */
    audioCodec?: string;
    /** 音频码率。 */
    audioBitrate?: string;
}

/**
 * 转 WAV 参数。
 */
export interface ConvertToWavArgs {
    /** 输入音频文件路径。 */
    inputFile: string;
    /** 输出 WAV 文件路径。 */
    outputFile: string;
    /** 采样率，默认 16000。 */
    sampleRate?: number;
    /** 声道数，默认 1。 */
    channels?: number;
}

/**
 * FFmpeg 基础设施网关。
 */
export default interface FfmpegGateway {
    /** 获取媒体时长。 */
    duration(filePath: string): Promise<number>;

    /** 获取媒体信息。 */
    getVideoInfo(filePath: string): Promise<VideoInfo>;

    /** 按起止时间分割视频。 */
    splitVideo(args: SplitVideoRangeArgs, options?: FfmpegRunOptions): Promise<void>;

    /** 按时间点切段视频。 */
    splitVideoByTimes(args: SplitVideoByTimesArgs, options?: FfmpegRunOptions): Promise<void>;

    /** 生成缩略图。 */
    createThumbnail(args: CreateThumbnailArgs, options?: FfmpegRunOptions): Promise<void>;

    /** 分割为音频片段。 */
    splitAudio(args: SplitAudioArgs, options?: FfmpegRunOptions): Promise<void>;

    /** 转换为 MP4。 */
    toMp4(inputFile: string, outputFile: string, options?: FfmpegRunOptions): Promise<void>;

    /** MKV 转 MP4。 */
    mkvToMp4(inputFile: string, outputFile: string, options?: FfmpegRunOptions): Promise<void>;

    /** 提取字幕。 */
    extractSubtitles(args: ExtractSubtitleArgs, options?: FfmpegRunOptions): Promise<void>;

    /** 裁剪视频。 */
    trimVideo(args: TrimVideoArgs, options?: FfmpegRunOptions): Promise<void>;

    /** 转 WAV。 */
    convertToWav(args: ConvertToWavArgs, options?: FfmpegRunOptions): Promise<void>;

    /** 裁剪音频。 */
    trimAudio(args: TrimAudioArgs, options?: FfmpegRunOptions): Promise<void>;
}
