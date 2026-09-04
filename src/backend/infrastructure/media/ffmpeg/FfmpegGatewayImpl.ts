import { injectable } from 'inversify';
import FfmpegGateway, {
    ConvertToWavArgs,
    CreateThumbnailArgs,
    ExtractSubtitleArgs,
    FfmpegExecutionError,
    FfmpegRunOptions,
    SplitVideoByTimesArgs,
    SplitVideoRangeArgs,
    TrimAudioArgs,
    TrimVideoArgs,
    VideoSegment,
} from '@/backend/services/gateways/media/FfmpegGateway';
import { VideoInfo } from '@/common/types/video-info';
import fs from 'fs';
import path from 'path';
import { getMainLogger } from '@/backend/infrastructure/logger';
import { CancelByUserError } from '@/backend/utils/errors/errors';
import { DefaultFfmpegCommandBuilder, FfmpegCommandBuilder } from '@/backend/infrastructure/media/ffmpeg/FfmpegCommandBuilder';
import { FfmpegProcessRunner } from '@/backend/infrastructure/media/ffmpeg/FfmpegProcessRunner';
import { getRuntimeResourcePath } from '@/backend/utils/runtimeEnv';

/**
 * FFprobe 流元数据。
 */
interface FfprobeStream {
    /** 流在输入媒体中的绝对索引，用于 -map 精确选流。 */
    index?: number;
    /** 流类型，例如 video、audio 或 subtitle。 */
    codec_type?: string;
    /** 编码器名称，例如 h264、subrip、hdmv_pgs_subtitle。 */
    codec_name?: string;
    /** 容器标签，MKV 等格式的语言信息存在这里。 */
    tags?: { language?: string };
}

/**
 * FFprobe 格式元数据。
 */
interface FfprobeFormat {
    /** 媒体总时长，单位秒；ffprobe JSON 中为字符串数字。 */
    duration?: string;
    /** 总码率，字符串数字格式。 */
    bit_rate?: string;
}

/**
 * FFprobe 返回结构。
 */
interface FfprobeData {
    /** 容器级别信息。 */
    format: FfprobeFormat;
    /** 音视频流列表。 */
    streams: FfprobeStream[];
}

/**
 * FFmpeg 网关可替换依赖集合。
 */
interface FfmpegGatewayDeps {
    /** 命令构建器替身。 */
    commandBuilder?: FfmpegCommandBuilder;
    /** 进程执行器替身。 */
    runner?: FfmpegProcessRunner;
}

/**
 * 转码类命令参数的公共形状：至少有输入路径，输出为单文件或分段模板。
 */
type FfmpegCommandTarget = {
    inputFile: string;
    outputFile?: string;
    outputPattern?: string;
};

/**
 * 可转 srt 的文本字幕编码器白名单。
 *
 * PGS/DVB 等图形字幕无法转文本，命中它们时 ffmpeg 会报“Subtitle codec not supported”；
 * 提取前先按此名单筛掉图形字幕，无文本字幕时直接返回“未提取到”。
 */
const TEXT_SUBTITLE_CODECS = new Set([
    'subrip', 'srt', 'ass', 'ssa', 'webvtt', 'mov_text', 'text', 'sami',
    'microdvd', 'subviewer', 'vplayer', 'mpl2', 'realtext', 'stl', 'pjs', 'jacosub',
]);

/**
 * FFmpeg 基础设施网关实现。
 */
@injectable()
export default class FfmpegGatewayImpl implements FfmpegGateway {
    private readonly logger = getMainLogger('FfmpegGatewayImpl');
    private readonly commandBuilder: FfmpegCommandBuilder;
    private readonly runner: FfmpegProcessRunner;

    /**
     * 构造 FFmpeg 网关。
     */
    constructor(deps: FfmpegGatewayDeps = {}) {
        this.commandBuilder = deps.commandBuilder ?? new DefaultFfmpegCommandBuilder();
        this.runner = deps.runner ?? new FfmpegProcessRunner();
    }

    /**
     * 获取媒体时长；探测不到有效时长属于数据异常，直接抛错而非返回 0。
     */
    public async duration(filePath: string): Promise<number> {
        this.assertInputFileExists(filePath);
        const rawDuration = Number((await this.probe(filePath)).format.duration);
        if (!Number.isFinite(rawDuration) || rawDuration <= 0) {
            throw new Error(`无法探测媒体时长：${filePath}`);
        }
        return rawDuration;
    }

    /**
     * 获取媒体信息。
     */
    public async getVideoInfo(filePath: string): Promise<VideoInfo> {
        this.assertInputFileExists(filePath);
        const [stats, probeData] = await Promise.all([fs.promises.stat(filePath), this.probe(filePath)]);

        return {
            filename: path.basename(filePath),
            duration: Number(probeData.format.duration) || 0,
            size: stats.size,
            modifiedTime: stats.mtimeMs,
            createdTime: stats.ctimeMs,
            bitrate: probeData.format.bit_rate ? parseInt(probeData.format.bit_rate, 10) : undefined,
            videoCodec: probeData.streams.find((stream) => stream.codec_type === 'video')?.codec_name,
            audioCodec: probeData.streams.find((stream) => stream.codec_type === 'audio')?.codec_name,
        };
    }

    /**
     * 按起止时间分割视频。
     */
    public async splitVideo(args: SplitVideoRangeArgs, options: FfmpegRunOptions = {}): Promise<void> {
        await this.runCommand(args, (a) => this.commandBuilder.buildSplitVideo(a), options);
    }

    /**
     * 按时间点切段视频；落刀点受关键帧影响，切分后逐段实测时长并累加出真实边界。
     */
    public async splitVideoByTimes(args: SplitVideoByTimesArgs, options: FfmpegRunOptions = {}): Promise<VideoSegment[]> {
        await this.runCommand(args, (a) => this.commandBuilder.buildSplitVideoByTimes(a), options);
        return await this.collectSegments(args.outputPattern);
    }

    /**
     * 枚举切分产物文件并实测每段时长，累加得到各段在原视频中的实际起止时间。
     * @param outputPattern 切分输出命名模板，如 /tmp/chunk_%03d.mp4。
     */
    private async collectSegments(outputPattern: string): Promise<VideoSegment[]> {
        const directory = path.dirname(outputPattern);
        const prefix = path.basename(outputPattern).split('%')[0];
        const files = (await fs.promises.readdir(directory))
            .filter(file => file.startsWith(prefix))
            .sort()
            .map(file => path.join(directory, file));

        const segments: VideoSegment[] = [];
        let start = 0;
        for (const file of files) {
            const duration = await this.duration(file);
            segments.push({ file, start, end: start + duration });
            start += duration;
        }
        return segments;
    }

    /**
     * 生成缩略图。
     */
    public async createThumbnail(args: CreateThumbnailArgs, options: FfmpegRunOptions = {}): Promise<void> {
        await this.runCommand(args, (a) => this.commandBuilder.buildThumbnail(a), options);
    }

    /**
     * 提取文本字幕；先用 ffprobe 选定单条文本字幕流，无候选时返回 false。
     */
    public async extractSubtitles(args: ExtractSubtitleArgs, options: FfmpegRunOptions = {}): Promise<boolean> {
        this.assertInputFileExists(args.inputFile);
        const streamIndex = this.selectTextSubtitleStream(
            (await this.probe(args.inputFile)).streams,
            args.preferLanguage,
        );
        if (streamIndex === undefined) {
            return false;
        }

        await this.runCommand(
            { inputFile: args.inputFile, outputFile: args.outputFile, streamIndex },
            (a) => this.commandBuilder.buildExtractSubtitle(a),
            options,
        );
        return true;
    }

    /**
     * 从探测到的流列表中选定唯一文本字幕流：优先匹配偏好语言，否则取第一条。
     * @param streams ffprobe 探测到的流列表。
     * @param preferLanguage 偏好语言标签（如 eng）。
     * @returns 选定流的绝对索引；无文本字幕时返回 undefined。
     */
    private selectTextSubtitleStream(streams: FfprobeStream[], preferLanguage?: string): number | undefined {
        const textSubtitles = streams.filter((stream) =>
            stream.codec_type === 'subtitle'
            && typeof stream.index === 'number'
            && typeof stream.codec_name === 'string'
            && TEXT_SUBTITLE_CODECS.has(stream.codec_name));
        const preferred = preferLanguage
            ? textSubtitles.find(stream => stream.tags?.language === preferLanguage)
            : undefined;
        return (preferred ?? textSubtitles[0])?.index;
    }

    /**
     * 转换为 MP4。
     */
    public async toMp4(inputFile: string, outputFile: string, options: FfmpegRunOptions = {}): Promise<void> {
        await this.runCommand(
            { inputFile, outputFile },
            (a) => this.commandBuilder.buildToMp4(a.inputFile, a.outputFile),
            options,
        );
    }

    /**
     * MKV 转 MP4。
     */
    public async mkvToMp4(inputFile: string, outputFile: string, options: FfmpegRunOptions = {}): Promise<void> {
        await this.runCommand(
            { inputFile, outputFile },
            (a) => this.commandBuilder.buildMkvToMp4(a.inputFile, a.outputFile),
            options,
        );
    }

    /**
     * 裁剪视频。
     */
    public async trimVideo(args: TrimVideoArgs, options: FfmpegRunOptions = {}): Promise<void> {
        await this.runCommand(args, (a) => this.commandBuilder.buildTrimVideo(a), options);
    }

    /**
     * 转 WAV。
     */
    public async convertToWav(args: ConvertToWavArgs, options: FfmpegRunOptions = {}): Promise<void> {
        await this.runCommand(args, (a) => this.commandBuilder.buildConvertToWav(a), options);
    }

    /**
     * 裁剪音频。
     */
    public async trimAudio(args: TrimAudioArgs, options: FfmpegRunOptions = {}): Promise<void> {
        await this.runCommand(args, (a) => this.commandBuilder.buildTrimAudio(a), options);
    }

    /**
     * 调用 ffprobe 获取媒体元数据，与 ffmpeg 共用同一条子进程执行路径。
     * @param filePath 媒体文件路径。
     */
    private async probe(filePath: string): Promise<FfprobeData> {
        const outcome = await this.runner.run({
            ffmpegPath: getRuntimeResourcePath('lib', 'ffprobe'),
            args: ['-v', 'error', '-print_format', 'json', '-show_format', '-show_streams', filePath],
        });

        try {
            return JSON.parse(outcome.stdoutText) as FfprobeData;
        } catch {
            throw new Error(`ffprobe 输出无法解析：${filePath}\n${outcome.stdoutText.slice(0, 500)}`);
        }
    }

    /**
     * 转码类命令的统一执行入口：校验输入输出、按需探测输入时长、构建并执行命令。
     * @param args 命令参数，含输入与输出路径。
     * @param build 从参数构建 FFmpeg 参数列表的函数。
     * @param options 进度、取消与 job 身份等执行选项。
     */
    private async runCommand<T extends FfmpegCommandTarget>(
        args: T,
        build: (args: T) => string[],
        options: FfmpegRunOptions,
    ): Promise<void> {
        this.assertInputFileExists(args.inputFile);
        this.assertOutputDirectoryExists(args.outputFile ?? args.outputPattern);

        // 上层未显式提供时长时，只要关注进度就自动探测，进度回调不再依赖调用方记得传时长。
        const inputDurationSecond = options.inputDurationSecond
            ?? (options.onProgress ? await this.duration(args.inputFile) : undefined);

        await this.executeCommand(build(args), { ...options, inputDurationSecond });
    }

    /**
     * 校验输入文件存在，路径错误时尽早失败并给出明确路径。
     */
    private assertInputFileExists(inputFile: string): void {
        if (!fs.existsSync(inputFile)) {
            throw new Error(`输入文件不存在：${inputFile}`);
        }
    }

    /**
     * 校验输出路径所在目录存在；目录缺失时 ffmpeg 只会在深处报出模糊错误。
     */
    private assertOutputDirectoryExists(outputPath?: string): void {
        if (!outputPath) return;
        const directory = path.dirname(outputPath);
        if (!fs.existsSync(directory)) {
            throw new Error(`输出目录不存在：${directory}`);
        }
    }

    /**
     * 执行 FFmpeg 命令并透出进度与取消。
     * @param commandArgs 完整参数列表。
     * @param options 进度、取消与 job 身份等执行选项。
     */
    private async executeCommand(commandArgs: string[], options: FfmpegRunOptions): Promise<void> {
        const startedAt = Date.now();
        const runningTask = this.runner.start(
            {
                ffmpegPath: getRuntimeResourcePath('lib', 'ffmpeg'),
                args: commandArgs,
                inputDurationSecond: options.inputDurationSecond,
                job: options.job,
            },
            {
                onStart: (commandLine, pid) => {
                    this.logger.info('spawned ffmpeg', { job: options.job, pid, command: commandLine });
                },
                onStderrLine: (line) => {
                    this.logger.debug('ffmpeg stderr line', { job: options.job, line });
                },
                onProgress: (event) => {
                    if (typeof event.percent !== 'number') return;
                    options.onProgress?.(Math.floor(Math.max(event.percent, 0)));
                },
            },
        );

        options.onCancelable?.(() => {
            runningTask.cancel();
        });

        try {
            const outcome = await runningTask.result;
            // 命令已在 onStart 记录，这里只补退出码与耗时，便于慢环节归因。
            this.logger.info('FFmpeg 执行完成', { job: options.job, exitCode: outcome.exitCode, durationMs: outcome.durationMs });
        } catch (error) {
            const durationMs = Date.now() - startedAt;
            if (error instanceof CancelByUserError) {
                this.logger.info('FFmpeg 已取消', { job: options.job, durationMs });
                throw error;
            }
            // 子进程失败的唯一证据点：退出码、pid 与 stderr 尾部行都在这里落盘，上层不再重复记录。
            this.logger.error('FFmpeg 执行失败', {
                job: options.job,
                durationMs,
                ...(error instanceof FfmpegExecutionError
                    ? { exitCode: error.exitCode, pid: error.pid, stderrTail: error.stderrTail }
                    : {}),
                error,
            });
            throw error;
        }
    }
}
