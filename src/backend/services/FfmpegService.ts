import { inject, injectable } from 'inversify';
import { WithSemaphore } from '@/backend/utils/concurrency/decorators';
import { randomUUID } from 'crypto';
import path from 'path';
import TYPES from '@/backend/ioc/types';
import DpTaskService from '@/backend/services/DpTaskService';
import { getMainLogger } from '@/backend/infrastructure/logger';
import { VideoInfo } from '@/common/types/video-info';
import { CancelByUserError } from '@/backend/utils/errors/errors';
import FfmpegGateway, { FfmpegExecutionError, VideoSegment } from '@/backend/services/gateways/media/FfmpegGateway';
import FileSystemGateway from '@/backend/services/gateways/storage/FileSystemGateway';
import StorageDirectoryProvider from '@/backend/services/gateways/storage/StorageDirectoryProvider';

export default interface FfmpegService {
    splitVideo({
                   inputFile,
                   startSecond,
                   endSecond,
                   outputFile
               }: {
        inputFile: string,
        startSecond: number,
        endSecond: number,
        outputFile: string
    }): Promise<void>;

    /**
     * 按建议时间点切段视频；落刀点受关键帧影响，返回每段文件与切分后实测的真实起止时间。
     */
    splitVideoByTimes({
        inputFile,
        times,
        outputFolder
    }: {
        inputFile: string,
        times: number[],
        outputFolder: string
    }): Promise<VideoSegment[]>;

    duration(filePath: string): Promise<number>;

    /**
     * 生成缩略图；截图点超出视频长度时自动钳制到结尾前，时长由方法自行探测。
     */
    thumbnail({
                  inputFile,
                  outputFileName,
                  outputFolder,
                  time,
                  options
              }: {
        inputFile: string,
        outputFileName: string,
        outputFolder: string,
        time: number,
        options?: {
            quality?: 'low' | 'medium' | 'high' | 'ultra';
            width?: number;
            format?: 'jpg' | 'png';
        }
    }): Promise<void>;

    toMp4({
              inputFile,
              onProgress
          }: {
        inputFile: string,
        onProgress?: (progress: number) => void
    }): Promise<string>;

    mkvToMp4({
                 taskId,
                 inputFile,
                 outputFile,
                 onProgress
             }: {
        taskId: number,
        inputFile: string,
        outputFile?: string,
        onProgress?: (progress: number) => void
    }): Promise<string>;

    /**
     * 提取文本字幕；英语学习场景优先英文字幕轨，无匹配时回退第一条文本字幕。
     * @returns 成功提取时返回 true；源媒体没有可转 srt 的文本字幕时返回 false。
     */
    extractSubtitles({
                         taskId,
                         inputFile,
                         outputFile,
                         onProgress
                     }: {
        taskId: number,
        inputFile: string,
        outputFile?: string,
        onProgress?: (progress: number) => void
    }): Promise<boolean>;

    trimVideo(inputPath: string, startTime: number, endTime: number, outputPath: string, job?: string): Promise<void>;

    /**
     * 获取视频信息。
     */
    getVideoInfo(filePath: string): Promise<VideoInfo>;

    /**
     * 转换音频文件为 WAV 格式。
     */
    convertToWav(inputPath: string, outputPath: string): Promise<void>;

    /**
     * 将媒体按时间范围直接转换为 16kHz 单声道 PCM WAV 分片。
     */
    createRecognitionWavChunks(args: {
        inputFile: string;
        ranges: Array<{ start: number; end: number }>;
        outputFolder: string;
        job?: string;
    }): Promise<string[]>;

    /**
     * 按时间范围裁剪音频并转码为 MP3。
     */
    trimAudio(inputPath: string, startTime: number, endTime: number, outputPath: string): Promise<void>;
}


/**
 * 把 dp_task ID 转成统一日志检索键，用于把一次后台任务的子进程日志串起来。
 * @param taskId 任务 ID；缺失时不伪造身份。
 * @returns `dp_task:<id>` 形式的 job 值，或 undefined。
 */
function dpTaskJob(taskId?: number): string | undefined {
    return taskId ? `dp_task:${taskId}` : undefined;
}

/**
 * FFmpeg 业务服务实现。
 */
@injectable()
export class FfmpegServiceImpl implements FfmpegService {
    @inject(TYPES.DpTaskService)
    private dpTaskService!: DpTaskService;

    @inject(TYPES.FfmpegGateway)
    private ffmpegGateway!: FfmpegGateway;

    @inject(TYPES.StorageDirectoryProvider)
    private storageDirectoryProvider!: StorageDirectoryProvider;

    @inject(TYPES.FileSystemGateway)
    private fileSystemGateway!: FileSystemGateway;

    private readonly logger = getMainLogger('FfmpegServiceImpl');

    /**
     * 分割视频。
     */
    @WithSemaphore('ffmpeg')
    public async splitVideo({
                                inputFile,
                                startSecond,
                                endSecond,
                                outputFile,
                            }: {
        inputFile: string,
        startSecond: number,
        endSecond: number,
        outputFile: string,
    }): Promise<void> {
        await this.storageDirectoryProvider.ensurePathAccessPermissionIfExists(inputFile);
        await this.storageDirectoryProvider.ensurePathAccessPermissionIfExists(outputFile);
        await this.ffmpegGateway.splitVideo({
            inputFile,
            startSecond,
            endSecond,
            outputFile,
        });
    }

    /**
     * 按建议时间点切段视频；临时分段名用随机前缀避免与历史残留混淆，返回实测起止边界。
     */
    @WithSemaphore('ffmpeg')
    public async splitVideoByTimes({
                                       inputFile,
                                       times,
                                       outputFolder,
                                   }: {
        inputFile: string,
        times: number[],
        outputFolder: string,
    }): Promise<VideoSegment[]> {
        await this.storageDirectoryProvider.ensurePathAccessPermissionIfExists(inputFile);
        await this.storageDirectoryProvider.ensurePathAccessPermissionIfExists(outputFolder);
        // 每次使用独立前缀，避免失败任务留下的旧分段混入本次结果。
        const outputPattern = path.join(outputFolder, `split-${randomUUID()}_%03d${path.extname(inputFile)}`);

        return await this.ffmpegGateway.splitVideoByTimes({
            inputFile,
            times,
            outputPattern,
        }, {
            job: `split:${outputFolder}`,
        });
    }

    /**
     * 获取视频时长。
     */
    @WithSemaphore('ffprobe')
    public async duration(filePath: string): Promise<number> {
        await this.storageDirectoryProvider.ensurePathAccessPermissionIfExists(filePath);
        return await this.ffmpegGateway.duration(filePath);
    }

    /**
     * 获取视频信息。
     */
    @WithSemaphore('ffprobe')
    public async getVideoInfo(filePath: string): Promise<VideoInfo> {
        await this.storageDirectoryProvider.ensurePathAccessPermissionIfExists(filePath);
        return await this.ffmpegGateway.getVideoInfo(filePath);
    }

    /**
     * 生成缩略图；截图点超出视频长度时自动钳制到结尾前。
     */
    @WithSemaphore('ffmpeg')
    public async thumbnail({
                               inputFile,
                               outputFileName,
                               outputFolder,
                               time,
                               options = {},
                           }: {
        inputFile: string,
        outputFileName: string,
        outputFolder: string,
        time: number,
        options?: {
            quality?: 'low' | 'medium' | 'high' | 'ultra';
            width?: number;
            format?: 'jpg' | 'png';
        },
    }): Promise<void> {
        await this.storageDirectoryProvider.ensurePathAccessPermissionIfExists(inputFile);
        await this.storageDirectoryProvider.ensurePathAccessPermissionIfExists(outputFolder);
        await this.fileSystemGateway.ensureDirectory(outputFolder);

        // 时长由方法自行探测，截图点钳制到视频结尾前，避免超出时长后 ffmpeg 静默产出空图。
        const totalDuration = await this.duration(inputFile);
        const actualTime = Math.min(time, totalDuration);

        const outputFile = path.join(outputFolder, outputFileName);
        const qualitySettings: Record<'low' | 'medium' | 'high' | 'ultra', { width: number; jpgQScale: number }> = {
            low: { width: 320, jpgQScale: 6 },
            medium: { width: 640, jpgQScale: 4 },
            high: { width: 1280, jpgQScale: 3 },
            ultra: { width: 1920, jpgQScale: 2 },
        };
        const quality = options.quality ?? 'medium';
        const preset = qualitySettings[quality];

        await this.ffmpegGateway.createThumbnail(
            {
                inputFile,
                outputFile,
                timeSecond: actualTime,
                width: options.width ?? preset.width,
                format: options.format ?? 'jpg',
                jpgQScale: preset.jpgQScale,
            },
        );
    }

    /**
     * 转换为 MP4。
     */
    @WithSemaphore('ffmpeg')
    public async toMp4({
                           inputFile,
                           onProgress,
                       }: {
        inputFile: string,
        onProgress?: (progress: number) => void,
    }): Promise<string> {
        await this.storageDirectoryProvider.ensurePathAccessPermissionIfExists(inputFile);
        const outputFile = path.join(
            path.dirname(inputFile),
            `${path.basename(inputFile, path.extname(inputFile))}.mp4`,
        );
        await this.storageDirectoryProvider.ensurePathAccessPermissionIfExists(outputFile);

        await this.ffmpegGateway.toMp4(inputFile, outputFile, { onProgress });

        return outputFile;
    }

    /**
     * MKV 转 MP4。
     */
    @WithSemaphore('ffmpeg')
    public async mkvToMp4({
                              taskId,
                              inputFile,
                              outputFile,
                              onProgress,
                          }: {
        taskId: number,
        inputFile: string,
        outputFile?: string,
        onProgress?: (progress: number) => void,
    }): Promise<string> {
        const finalOutputFile = outputFile ?? inputFile.replace(path.extname(inputFile), '.mp4');
        await this.storageDirectoryProvider.ensurePathAccessPermissionIfExists(inputFile);
        await this.storageDirectoryProvider.ensurePathAccessPermissionIfExists(finalOutputFile);

        await this.runCancelableTask(taskId, async (onCancelable) => {
            await this.ffmpegGateway.mkvToMp4(inputFile, finalOutputFile, {
                onProgress,
                onCancelable,
                job: dpTaskJob(taskId),
            });
        });

        return finalOutputFile;
    }

    /**
     * 提取文本字幕；优先英文字幕轨，无匹配时由网关回退第一条文本字幕，返回是否提取到。
     */
    @WithSemaphore('ffmpeg')
    public async extractSubtitles({
                                      taskId,
                                      inputFile,
                                      outputFile,
                                      onProgress,
                                  }: {
        taskId: number,
        inputFile: string,
        outputFile?: string,
        onProgress?: (progress: number) => void,
    }): Promise<boolean> {
        const finalOutputFile = outputFile ?? inputFile.replace(path.extname(inputFile), '.srt');
        await this.storageDirectoryProvider.ensurePathAccessPermissionIfExists(inputFile);
        await this.storageDirectoryProvider.ensurePathAccessPermissionIfExists(finalOutputFile);

        let extracted = false;
        await this.runCancelableTask(taskId, async (onCancelable) => {
            extracted = await this.ffmpegGateway.extractSubtitles(
                {
                    inputFile,
                    outputFile: finalOutputFile,
                    // 英语学习场景优先英文字幕，无匹配时回退第一条文本字幕。
                    preferLanguage: 'eng',
                },
                {
                    onProgress,
                    onCancelable,
                    job: dpTaskJob(taskId),
                },
            );
        });
        return extracted;
    }

    /**
     * 裁剪视频。
     * @param inputPath 源视频绝对路径。
     * @param startTime 起始时间（秒）。
     * @param endTime 结束时间（秒）。
     * @param outputPath 输出视频绝对路径。
     * @param job 所属后台任务身份标识，如 `clip:<clipKey>`。
     */
    @WithSemaphore('ffmpeg')
    public async trimVideo(
        inputPath: string,
        startTime: number,
        endTime: number,
        outputPath: string,
        job?: string,
    ): Promise<void> {
        await this.storageDirectoryProvider.ensurePathAccessPermissionIfExists(inputPath);
        await this.storageDirectoryProvider.ensurePathAccessPermissionIfExists(outputPath);
        await this.ffmpegGateway.trimVideo({
            inputFile: inputPath,
            outputFile: outputPath,
            startSecond: startTime,
            endSecond: endTime,
            videoCodec: 'libx265',
            // x265 默认 medium 预设极慢；短片段用 veryfast 提速明显且质量差异不可感知。
            videoPreset: 'veryfast',
            audioCodec: 'aac',
            outputWidth: 640,
            crf: 28,
            audioChannels: 1,
            audioBitrate: '64k',
        }, { job });
    }

    /**
     * 转换音频文件为 WAV 格式（强制 16kHz、单声道、16-bit PCM）。
     */
    @WithSemaphore('ffmpeg')
    public async convertToWav(inputPath: string, outputPath: string): Promise<void> {
        await this.storageDirectoryProvider.ensurePathAccessPermissionIfExists(inputPath);
        await this.storageDirectoryProvider.ensurePathAccessPermissionIfExists(outputPath);
        await this.ffmpegGateway.convertToWav({
            inputFile: inputPath,
            outputFile: outputPath,
            sampleRate: 16000,
            channels: 1,
        });
    }

    /**
     * 裁剪音频（按时间，转码为 MP3 以保证兼容）；非法时间区间直接抛错，不静默产出空结果。
     */
    @WithSemaphore('ffmpeg')
    public async trimAudio(
        inputPath: string,
        startTime: number,
        endTime: number,
        outputPath: string,
    ): Promise<void> {
        await this.storageDirectoryProvider.ensurePathAccessPermissionIfExists(inputPath);
        await this.storageDirectoryProvider.ensurePathAccessPermissionIfExists(outputPath);
        await this.ffmpegGateway.trimAudio({
            inputFile: inputPath,
            outputFile: outputPath,
            startSecond: startTime,
            endSecond: endTime,
            audioCodec: 'libmp3lame',
            audioBitrate: '192k',
        });
    }

    /**
     * 将媒体直接裁剪并转换为语音识别需要的 WAV 分片，避免有损中间格式和嵌套信号量。
     * @param args 输入媒体、分片时间范围和输出目录。
     * @returns 与时间范围顺序一致的 WAV 文件路径。
     */
    @WithSemaphore('ffmpeg')
    public async createRecognitionWavChunks(args: {
        inputFile: string;
        ranges: Array<{ start: number; end: number }>;
        outputFolder: string;
        job?: string;
    }): Promise<string[]> {
        await this.storageDirectoryProvider.ensurePathAccessPermissionIfExists(args.inputFile);
        await this.fileSystemGateway.ensureDirectory(args.outputFolder);
        const outputs: string[] = [];
        for (let index = 0; index < args.ranges.length; index++) {
            const range = args.ranges[index];
            const outputPath = path.join(args.outputFolder, `parakeet_${String(index + 1).padStart(3, '0')}.wav`);
            await this.ffmpegGateway.convertToWav({
                inputFile: args.inputFile,
                outputFile: outputPath,
                sampleRate: 16000,
                channels: 1,
                startSecond: range.start,
                endSecond: range.end,
            }, {
                job: args.job,
            });
            outputs.push(outputPath);
        }
        return outputs;
    }

    /**
     * 执行支持取消的任务，并统一处理取消异常。
     * @param taskId dp_task ID；缺失时无法注册取消回调也不参与 job 归因。
     * @param runner 接收取消注册回调的任务体。
     */
    private async runCancelableTask(
        taskId: number | undefined,
        runner: (onCancelable: (cancel: () => void) => void) => Promise<void>,
    ): Promise<void> {
        const job = dpTaskJob(taskId);
        let cancelledByUser = false;
        let hasCancelable = false;

        const onCancelable = (cancel: () => void): void => {
            hasCancelable = true;
            if (!taskId) return;
            this.dpTaskService.registerTask(taskId, {
                cancel(): void {
                    cancelledByUser = true;
                    cancel();
                },
            });
        };

        try {
            await runner(onCancelable);
            return;
        } catch (error) {
            const normalized = error instanceof Error ? error : new Error(String(error));
            // 子进程退出与取消已由网关作为唯一证据点记录，这里只补记网关看不到的任务体异常。
            const alreadyReported = error instanceof FfmpegExecutionError
                || error instanceof CancelByUserError
                || cancelledByUser;
            if (!alreadyReported) {
                this.logger.error('ffmpeg task failed', { job, error: normalized });
            }
            throw this.processError(normalized, cancelledByUser);
        } finally {
            if (taskId && !hasCancelable) {
                this.logger.debug('ffmpeg task finished without cancel handle', { job });
            }
        }
    }

    /**
     * 统一错误处理。
     * @param error 任务体抛出的异常。
     * @param cancelledByUser 任务是否已被用户标记取消。
     * @returns 取消场景归一为 CancelByUserError，其余原样透出。
     */
    private processError(error: Error, cancelledByUser = false): Error {
        if (cancelledByUser) {
            return new CancelByUserError();
        }

        return error;
    }
}
