import { inject, injectable } from 'inversify';
import { WithSemaphore } from '@/backend/application/kernel/concurrency/decorators';
import path from 'path';
import fs from 'fs';
import TYPES from '@/backend/ioc/types';
import FfmpegService from '@/backend/application/services/FfmpegService';
import DpTaskService from '@/backend/application/services/DpTaskService';
import { getMainLogger } from '@/backend/infrastructure/logger';
import { VideoInfo } from '@/common/types/video-info';
import { CancelByUserError } from '@/backend/application/errors/errors';
import FfmpegGateway from '@/backend/application/ports/gateways/media/FfmpegGateway';

/**
 * FFmpeg 业务服务实现。
 */
@injectable()
export default class FfmpegServiceImpl implements FfmpegService {
    @inject(TYPES.DpTaskService)
    private dpTaskService!: DpTaskService;

    @inject(TYPES.FfmpegGateway)
    private ffmpegGateway!: FfmpegGateway;

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
        await this.ffmpegGateway.splitVideo({
            inputFile,
            startSecond,
            endSecond,
            outputFile,
        });
    }

    /**
     * 按时间点分割视频。
     */
    @WithSemaphore('ffmpeg')
    public async splitVideoByTimes({
                                       inputFile,
                                       times,
                                       outputFolder,
                                       outputFilePrefix,
                                   }: {
        inputFile: string,
        times: number[],
        outputFolder: string,
        outputFilePrefix: string,
    }): Promise<string[]> {
        const outputPattern = path.join(outputFolder, `${outputFilePrefix}_%03d${path.extname(inputFile)}`);

        await this.ffmpegGateway.splitVideoByTimes({
            inputFile,
            times,
            outputPattern,
        });

        return await this.getOutputFiles(outputFolder, outputFilePrefix);
    }

    /**
     * 获取视频时长。
     */
    @WithSemaphore('ffprobe')
    public async duration(filePath: string): Promise<number> {
        return await this.ffmpegGateway.duration(filePath);
    }

    /**
     * 获取视频信息。
     */
    @WithSemaphore('ffprobe')
    public async getVideoInfo(filePath: string): Promise<VideoInfo> {
        return await this.ffmpegGateway.getVideoInfo(filePath);
    }

    /**
     * 生成缩略图。
     */
    @WithSemaphore('ffmpeg')
    public async thumbnail({
                               inputFile,
                               outputFileName,
                               outputFolder,
                               time,
                               inputDuration,
                               options = {},
                           }: {
        inputFile: string,
        outputFileName: string,
        outputFolder: string,
        time: number,
        inputDuration?: number,
        options?: {
            quality?: 'low' | 'medium' | 'high' | 'ultra';
            width?: number;
            format?: 'jpg' | 'png';
        },
    }): Promise<void> {
        const totalDuration = Number.isFinite(inputDuration) ? Number(inputDuration) : await this.duration(inputFile);
        const actualTime = Math.min(time, totalDuration);

        if (!fs.existsSync(outputFolder)) {
            fs.mkdirSync(outputFolder, { recursive: true });
        }

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
            {
                inputDurationSecond: totalDuration,
            },
        );
    }

    /**
     * 分割为音频文件。
     */
    @WithSemaphore('ffmpeg')
    public async splitToAudio({
                                  taskId,
                                  inputFile,
                                  outputFolder,
                                  segmentTime,
                                  onProgress,
                              }: {
        taskId?: number,
        inputFile: string,
        outputFolder: string,
        segmentTime: number,
        onProgress?: (percent: number) => void,
    }): Promise<string[]> {
        const outputPattern = path.join(outputFolder, 'output_%03d.mp3');
        const inputDurationSecond = await this.duration(inputFile);

        await this.runCancelableTask(
            taskId,
            {
                inputDurationSecond,
                onProgress,
            },
            async (onCancelable) => {
                await this.ffmpegGateway.splitAudio(
                    {
                        inputFile,
                        segmentSecond: segmentTime,
                        outputPattern,
                    },
                    {
                        inputDurationSecond,
                        onProgress,
                        onCancelable,
                    },
                );
            },
        );

        return await this.getOutputFiles(outputFolder, 'output_', '.mp3');
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
        const outputFile = inputFile.replace(path.extname(inputFile), '.mp4');
        const inputDurationSecond = await this.duration(inputFile);

        await this.ffmpegGateway.toMp4(inputFile, outputFile, {
            onProgress,
            inputDurationSecond,
        });

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
        const inputDurationSecond = await this.duration(inputFile);

        await this.runCancelableTask(
            taskId,
            {
                inputDurationSecond,
                onProgress,
            },
            async (onCancelable) => {
                await this.ffmpegGateway.mkvToMp4(inputFile, finalOutputFile, {
                    inputDurationSecond,
                    onProgress,
                    onCancelable,
                });
            },
        );

        return finalOutputFile;
    }

    /**
     * 提取字幕。
     */
    @WithSemaphore('ffmpeg')
    public async extractSubtitles({
                                      taskId,
                                      inputFile,
                                      outputFile,
                                      onProgress,
                                      en,
                                  }: {
        taskId: number,
        inputFile: string,
        outputFile?: string,
        onProgress?: (progress: number) => void,
        en: boolean,
    }): Promise<string> {
        const finalOutputFile = outputFile ?? inputFile.replace(path.extname(inputFile), '.srt');
        const mapRule = en ? '0:s:m:language:eng?' : '0:s:0?';

        await this.runCancelableTask(
            taskId,
            { onProgress },
            async (onCancelable) => {
                await this.ffmpegGateway.extractSubtitles(
                    {
                        inputFile,
                        outputFile: finalOutputFile,
                        mapRule,
                    },
                    {
                        onProgress,
                        onCancelable,
                    },
                );
            },
        );

        return finalOutputFile;
    }

    /**
     * 裁剪视频。
     */
    @WithSemaphore('ffmpeg')
    public async trimVideo(
        inputPath: string,
        startTime: number,
        endTime: number,
        outputPath: string,
    ): Promise<void> {
        await this.ffmpegGateway.trimVideo({
            inputFile: inputPath,
            outputFile: outputPath,
            startSecond: startTime,
            endSecond: endTime,
            videoCodec: 'libx265',
            audioCodec: 'aac',
            outputWidth: 640,
            crf: 28,
            audioChannels: 1,
            audioBitrate: '64k',
        });
    }

    /**
     * 转换音频文件为 WAV 格式（强制 16kHz、单声道、16-bit PCM）。
     */
    @WithSemaphore('ffmpeg')
    public async convertToWav(inputPath: string, outputPath: string): Promise<void> {
        await this.ffmpegGateway.convertToWav({
            inputFile: inputPath,
            outputFile: outputPath,
            sampleRate: 16000,
            channels: 1,
        });
    }

    /**
     * 裁剪音频（按时间，转码为 MP3 以保证兼容）。
     */
    @WithSemaphore('ffmpeg')
    public async trimAudio(
        inputPath: string,
        startTime: number,
        endTime: number,
        outputPath: string,
    ): Promise<void> {
        const duration = endTime - startTime;
        if (!Number.isFinite(duration) || duration <= 0) {
            return;
        }

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
     * 基于时间线批量切段音频。
     */
    @WithSemaphore('ffmpeg')
    public async splitAudioByTimeline(args: {
        inputFile: string,
        ranges: Array<{ start: number, end: number }>,
        outputFolder: string,
        outputFilePrefix?: string,
    }): Promise<string[]> {
        const { inputFile, ranges } = args;
        const prefix = args.outputFilePrefix ?? 'segment_';

        if (!fs.existsSync(args.outputFolder)) {
            await fs.promises.mkdir(args.outputFolder, { recursive: true });
        }

        const outputs: string[] = [];
        for (let index = 0; index < ranges.length; index++) {
            const range = ranges[index];
            const outputPath = path.join(args.outputFolder, `${prefix}${String(index + 1).padStart(3, '0')}.mp3`);
            await this.trimAudio(inputFile, range.start, range.end, outputPath);
            outputs.push(outputPath);
        }

        return outputs;
    }

    /**
     * 执行支持取消的任务，并统一处理取消异常。
     */
    private async runCancelableTask(
        taskId: number | undefined,
        context: {
            inputDurationSecond?: number;
            onProgress?: (progress: number) => void;
        },
        runner: (onCancelable: (cancel: () => void) => void) => Promise<void>,
    ): Promise<void> {
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
            this.logger.error('An error occurred while executing ffmpeg command:', {
                error: normalized,
                context,
            });
            throw this.processError(normalized, cancelledByUser);
        } finally {
            if (taskId && !hasCancelable) {
                this.logger.debug('ffmpeg task finished without cancel handle', { taskId });
            }
        }
    }

    /**
     * 统一错误处理。
     */
    private processError(error: Error, cancelledByUser = false): Error {
        if (cancelledByUser) {
            return new CancelByUserError();
        }

        if (/SIGKILL|SIGTERM|killed/i.test(error.message)) {
            return new CancelByUserError();
        }

        return error;
    }

    /**
     * 获取输出文件列表。
     */
    private async getOutputFiles(outputFolder: string, prefix: string, ext?: string): Promise<string[]> {
        const files = await fs.promises.readdir(outputFolder);
        return files
            .filter(file => file.startsWith(prefix) && (ext ? file.endsWith(ext) : true))
            .sort()
            .map(file => path.join(outputFolder, file));
    }
}
