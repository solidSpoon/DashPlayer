import { VideoInfo } from '@/common/types/video-info';

/**
 * FFmpeg 进程非零退出错误。
 *
 * 定义在网关契约中，保证业务服务只需依赖端口即可读取结构化失败信息。
 */
export class FfmpegExecutionError extends Error {
    /** 进程退出码。 */
    public readonly exitCode: number;
    /** 退出前保留的 stderr 尾部行；以数组入日志可绕开单字段长度截断。 */
    public readonly stderrTail: string[];
    /** 执行耗时，单位毫秒。 */
    public readonly durationMs: number;
    /** 关联的子进程身份标识。 */
    public readonly job?: string;
    /** 操作系统进程号；spawn 立即失败时可能为空。 */
    public readonly pid?: number;

    /**
     * 构造非零退出错误。
     * @param params 退出码、stderr 尾部行、耗时、身份与进程号。
     */
    public constructor(params: {
        exitCode: number;
        stderrTail: string[];
        durationMs: number;
        job?: string;
        pid?: number;
    }) {
        super(`FFmpeg 退出码 ${params.exitCode}\n${params.stderrTail.join('\n')}`);
        this.name = 'FfmpegExecutionError';
        this.exitCode = params.exitCode;
        this.stderrTail = params.stderrTail;
        this.durationMs = params.durationMs;
        this.job = params.job;
        this.pid = params.pid;
    }
}

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
    /**
     * 子进程身份标识，用于把同一次后台任务的日志串起来。
     * 约定取值：`dp_task:<id>` / `transcription:<filePath>` / `clip:<clipKey>` / `split:<folder>`。
     */
    job?: string;
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
    /** 切段时间点（秒，严格递增）；实际落刀点受关键帧位置影响。 */
    times: number[];
    /** 输出路径模板，如 /tmp/chunk_%03d.mp4。 */
    outputPattern: string;
}

/**
 * 切分产物段信息。
 */
export interface VideoSegment {
    /** 分段文件绝对路径。 */
    file: string;
    /** 该段在原视频中的实际起始时间（秒），由切分后实测得出。 */
    start: number;
    /** 该段在原视频中的实际结束时间（秒），由切分后实测得出。 */
    end: number;
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
 * 提取字幕参数。
 */
export interface ExtractSubtitleArgs {
    /** 输入媒体文件路径。 */
    inputFile: string;
    /** 输出字幕文件路径。 */
    outputFile: string;
    /** 优先选择的字幕语言标签（如 eng）；无匹配时回退第一条文本字幕。 */
    preferLanguage?: string;
}

/**
 * 字幕提取命令参数：字幕流由网关 ffprobe 探测选定，调用方不得凭猜测拼 map 规则。
 */
export interface ExtractSubtitleCommandArgs {
    /** 输入媒体文件路径。 */
    inputFile: string;
    /** 输出字幕文件路径。 */
    outputFile: string;
    /** 选定字幕流在输入媒体中的绝对流索引。 */
    streamIndex: number;
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
    /** 编码器速度预设（如 veryfast）；x265 默认 medium 过慢，按场景显式指定。 */
    videoPreset?: string;
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
    /** 可选裁剪起点，单位为秒。 */
    startSecond?: number;
    /** 可选裁剪终点，单位为秒；必须与起点同时提供。 */
    endSecond?: number;
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

    /**
     * 按时间点切段视频；落刀点受关键帧影响，返回的每段起止时间为切分后实测值。
     */
    splitVideoByTimes(args: SplitVideoByTimesArgs, options?: FfmpegRunOptions): Promise<VideoSegment[]>;

    /** 生成缩略图。 */
    createThumbnail(args: CreateThumbnailArgs, options?: FfmpegRunOptions): Promise<void>;

    /** 转换为 MP4。 */
    toMp4(inputFile: string, outputFile: string, options?: FfmpegRunOptions): Promise<void>;

    /** MKV 转 MP4。 */
    mkvToMp4(inputFile: string, outputFile: string, options?: FfmpegRunOptions): Promise<void>;

    /**
     * 提取文本字幕；优先匹配 preferLanguage 的文本字幕轨，无匹配时取第一条。
     * 源媒体没有可转 srt 的文本字幕（如只有 PGS 图形字幕）时返回 false。
     */
    extractSubtitles(args: ExtractSubtitleArgs, options?: FfmpegRunOptions): Promise<boolean>;

    /** 裁剪视频。 */
    trimVideo(args: TrimVideoArgs, options?: FfmpegRunOptions): Promise<void>;

    /** 转 WAV。 */
    convertToWav(args: ConvertToWavArgs, options?: FfmpegRunOptions): Promise<void>;

    /** 裁剪音频。 */
    trimAudio(args: TrimAudioArgs, options?: FfmpegRunOptions): Promise<void>;
}
