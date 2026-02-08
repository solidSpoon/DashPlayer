import { inject, injectable } from 'inversify';
import ffmpeg from 'fluent-ffmpeg';
import FfmpegGateway, {
    ConvertToWavArgs,
    CreateThumbnailArgs,
    ExtractSubtitleArgs,
    FfmpegRunOptions,
    SplitAudioArgs,
    SplitVideoByTimesArgs,
    SplitVideoRangeArgs,
    TrimAudioArgs,
    TrimVideoArgs,
} from '@/backend/application/ports/gateways/media/FfmpegGateway';
import LocationService, { ProgramType } from '@/backend/application/services/LocationService';
import TYPES from '@/backend/ioc/types';
import { VideoInfo } from '@/common/types/video-info';
import fs from 'fs';
import path from 'path';
import { getMainLogger } from '@/backend/infrastructure/logger';
import { DefaultFfmpegCommandBuilder, FfmpegCommandBuilder } from '@/backend/infrastructure/media/ffmpeg/FfmpegCommandBuilder';
import { FfmpegProcessRunner } from '@/backend/infrastructure/media/ffmpeg/FfmpegProcessRunner';

/**
 * FFprobe 视频流元数据。
 */
interface FfprobeStream {
    /** 流类型，例如 video 或 audio。 */
    codec_type?: string;
    /** 编码器名称，例如 h264。 */
    codec_name?: string;
}

/**
 * FFprobe 格式元数据。
 */
interface FfprobeFormat {
    /** 媒体总时长，单位秒。 */
    duration?: number;
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
    constructor(
        @inject(TYPES.LocationService) private readonly locationService: LocationService,
        deps: FfmpegGatewayDeps = {},
    ) {
        this.commandBuilder = deps.commandBuilder ?? new DefaultFfmpegCommandBuilder();
        this.runner = deps.runner ?? new FfmpegProcessRunner();

        ffmpeg.setFfmpegPath(this.locationService.getThirdLibPath(ProgramType.FFMPEG));
        ffmpeg.setFfprobePath(this.locationService.getThirdLibPath(ProgramType.FFPROBE));
    }

    /**
     * 获取媒体时长。
     */
    public async duration(filePath: string): Promise<number> {
        return new Promise<number>((resolve, reject) => {
            ffmpeg.ffprobe(filePath, (err, metadata) => {
                if (err) reject(err);
                else resolve(metadata.format.duration ?? 0);
            });
        });
    }

    /**
     * 获取媒体信息。
     */
    public async getVideoInfo(filePath: string): Promise<VideoInfo> {
        const stats = await fs.promises.stat(filePath);
        const probeData = await new Promise<FfprobeData>((resolve, reject) => {
            ffmpeg.ffprobe(filePath, (err, metadata) => {
                if (err) reject(err);
                else resolve(metadata as FfprobeData);
            });
        });

        return {
            filename: path.basename(filePath),
            duration: probeData.format.duration || 0,
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
        const commandArgs = this.commandBuilder.buildSplitVideo({
            inputFile: args.inputFile,
            outputFile: args.outputFile,
            startSecond: args.startSecond,
            endSecond: args.endSecond,
        });

        await this.executeCommand(commandArgs, options);
    }

    /**
     * 按时间点切段视频。
     */
    public async splitVideoByTimes(args: SplitVideoByTimesArgs, options: FfmpegRunOptions = {}): Promise<void> {
        const commandArgs = this.commandBuilder.buildSplitVideoByTimes({
            inputFile: args.inputFile,
            times: args.times,
            outputPattern: args.outputPattern,
        });

        await this.executeCommand(commandArgs, options);
    }

    /**
     * 生成缩略图。
     */
    public async createThumbnail(args: CreateThumbnailArgs, options: FfmpegRunOptions = {}): Promise<void> {
        const commandArgs = this.commandBuilder.buildThumbnail({
            inputFile: args.inputFile,
            outputFile: args.outputFile,
            timeSecond: args.timeSecond,
            width: args.width,
            format: args.format,
            jpgQScale: args.jpgQScale,
        });

        await this.executeCommand(commandArgs, options);
    }

    /**
     * 分段音频。
     */
    public async splitAudio(args: SplitAudioArgs, options: FfmpegRunOptions = {}): Promise<void> {
        const commandArgs = this.commandBuilder.buildSplitAudio({
            inputFile: args.inputFile,
            segmentSecond: args.segmentSecond,
            outputPattern: args.outputPattern,
        });

        await this.executeCommand(commandArgs, options);
    }

    /**
     * 转 MP4。
     */
    public async toMp4(inputFile: string, outputFile: string, options: FfmpegRunOptions = {}): Promise<void> {
        const commandArgs = this.commandBuilder.buildToMp4(inputFile, outputFile);
        await this.executeCommand(commandArgs, options);
    }

    /**
     * MKV 转 MP4。
     */
    public async mkvToMp4(inputFile: string, outputFile: string, options: FfmpegRunOptions = {}): Promise<void> {
        const commandArgs = this.commandBuilder.buildMkvToMp4(inputFile, outputFile);
        await this.executeCommand(commandArgs, options);
    }

    /**
     * 提取字幕。
     */
    public async extractSubtitles(args: ExtractSubtitleArgs, options: FfmpegRunOptions = {}): Promise<void> {
        const commandArgs = this.commandBuilder.buildExtractSubtitle({
            inputFile: args.inputFile,
            outputFile: args.outputFile,
            mapRule: args.mapRule,
        });

        await this.executeCommand(commandArgs, options);
    }

    /**
     * 裁剪视频。
     */
    public async trimVideo(args: TrimVideoArgs, options: FfmpegRunOptions = {}): Promise<void> {
        const commandArgs = this.commandBuilder.buildTrimVideo(args);
        await this.executeCommand(commandArgs, options);
    }

    /**
     * 转 WAV。
     */
    public async convertToWav(args: ConvertToWavArgs, options: FfmpegRunOptions = {}): Promise<void> {
        const commandArgs = this.commandBuilder.buildConvertToWav(args);
        await this.executeCommand(commandArgs, options);
    }

    /**
     * 裁剪音频。
     */
    public async trimAudio(args: TrimAudioArgs, options: FfmpegRunOptions = {}): Promise<void> {
        const commandArgs = this.commandBuilder.buildTrimAudio(args);
        await this.executeCommand(commandArgs, options);
    }

    /**
     * 执行 FFmpeg 命令并透出进度与取消。
     */
    private async executeCommand(commandArgs: string[], options: FfmpegRunOptions): Promise<void> {
        const runningTask = this.runner.start(
            {
                ffmpegPath: this.locationService.getThirdLibPath(ProgramType.FFMPEG),
                args: commandArgs,
                inputDurationSecond: options.inputDurationSecond,
            },
            {
                onStart: (commandLine) => {
                    this.logger.info('Spawned Ffmpeg with command:', commandLine);
                },
                onStderrLine: (line) => {
                    this.logger.debug(`[FFmpeg] ${line}`);
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

        await runningTask.result;
    }
}
