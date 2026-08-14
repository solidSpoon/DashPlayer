import path from 'path';
import { inject, injectable } from 'inversify';
import { FolderVideos } from '@/common/contracts/convert';
import { CancelByUserError } from '@/backend/application/errors/errors';
import FileSystemGateway from '@/backend/application/ports/gateways/storage/FileSystemGateway';
import StorageDirectoryProvider from '@/backend/application/ports/gateways/storage/StorageDirectoryProvider';
import DpTaskService from '@/backend/application/services/DpTaskService';
import FfmpegService from '@/backend/application/services/FfmpegService';
import TYPES from '@/backend/ioc/types';

/**
 * 转换任务使用的输出文件路径。
 */
interface ConvertOutputPaths {
    /** 转换生成的 HTML5 MP4 文件路径。 */
    videoPath: string;
    /** 从视频中提取的字幕文件路径。 */
    subtitlePath: string;
}

/**
 * 负责视频转换用例的完整业务流程。
 *
 * Controller 只调用此服务；任务状态、输出路径和 FFmpeg 调用均在这里统一编排。
 */
@injectable()
export default class ConvertService {
    /**
     * 创建转换用例服务。
     * @param dpTaskService 后台任务状态服务。
     * @param ffmpegService FFmpeg 基础能力服务。
     * @param storageDirectoryProvider 外部路径权限恢复服务。
     * @param fileSystemGateway 文件系统访问入口。
     */
    constructor(
        @inject(TYPES.DpTaskService) private readonly dpTaskService: DpTaskService,
        @inject(TYPES.FfmpegService) private readonly ffmpegService: FfmpegService,
        @inject(TYPES.StorageDirectoryProvider) private readonly storageDirectoryProvider: StorageDirectoryProvider,
        @inject(TYPES.FileSystemGateway) private readonly fileSystemGateway: FileSystemGateway,
    ) {}

    /**
     * 创建并启动一个 MKV 转 HTML5 MP4 的后台任务。
     *
     * @param inputFile 待转换视频的绝对路径。
     * @returns 创建后的任务 ID。
     * @throws 输入文件不存在或无法访问时直接抛错，不创建任务。
     */
    public async startToMp4(inputFile: string): Promise<number> {
        await this.storageDirectoryProvider.ensurePathAccessPermissionIfExists(inputFile);
        if (!await this.fileSystemGateway.fileExists(inputFile)) {
            throw new Error(`待转换视频不存在：${inputFile}`);
        }
        if (await this.fileSystemGateway.getFileSize(inputFile) === 0) {
            throw new Error(`待转换视频为空文件：${inputFile}`);
        }

        const taskId = await this.dpTaskService.create();
        void this.executeConversion(taskId, inputFile);
        return taskId;
    }

    /**
     * 扫描文件夹并返回尚未生成 HTML5 MP4 的 MKV 视频。
     * @param folders 待扫描的文件夹绝对路径。
     * @returns 每个文件夹对应的待转换视频集合。
     */
    public async listUnconvertedVideos(folders: string[]): Promise<FolderVideos[]> {
        const result: FolderVideos[] = [];
        for (const folder of folders) {
            await this.storageDirectoryProvider.ensurePathAccessPermissionIfExists(folder);
            const fileNames = await this.fileSystemGateway.listFileNames(folder);
            const videos: string[] = [];

            for (const fileName of fileNames) {
                if (path.extname(fileName).toLowerCase() !== '.mkv') {
                    continue;
                }

                const videoPath = path.join(folder, fileName);
                const outputPath = this.buildOutputPaths(videoPath).videoPath;
                if (!await this.hasNonEmptyFile(outputPath)) {
                    videos.push(videoPath);
                }
            }

            result.push({ folder, videos });
        }
        return result;
    }

    /**
     * 查找输入视频对应的 HTML5 MP4 文件。
     * @param filePath 原视频或 HTML5 MP4 文件绝对路径。
     * @returns 已存在的 HTML5 MP4 路径；不存在时返回 `null`。
     */
    public async suggestHtml5Video(filePath: string): Promise<string | null> {
        await this.storageDirectoryProvider.ensurePathAccessPermissionIfExists(filePath);
        const html5VideoPath = this.isHtml5Video(filePath)
            ? filePath
            : this.buildOutputPaths(filePath).videoPath;
        return await this.hasNonEmptyFile(html5VideoPath) ? html5VideoPath : null;
    }

    /**
     * 执行转换任务并保证后台异常会落到明确的任务状态。
     * @param taskId 转换任务 ID。
     * @param inputFile 待转换视频绝对路径。
     */
    private async executeConversion(taskId: number, inputFile: string): Promise<void> {
        const outputPaths = this.buildOutputPaths(inputFile);
        // 任务中心要求每次进度更新都携带输出路径，供渲染端持续展示转换结果。
        const updateProgress = (progress: number): void => {
            this.dpTaskService.process(taskId, {
                progress: '正在转换',
                result: this.buildTaskResult(progress, outputPaths.videoPath),
            });
        };

        try {
            updateProgress(0);
            await this.convertVideoIfNeeded(taskId, inputFile, outputPaths.videoPath, updateProgress);
            const subtitleExtracted = await this.extractSubtitleIfNeeded(
                taskId,
                inputFile,
                outputPaths.subtitlePath,
                updateProgress,
            );
            this.dpTaskService.finish(taskId, {
                progress: subtitleExtracted ? '转换完成' : '视频转换完成，未提取到字幕',
                result: this.buildTaskResult(100, outputPaths.videoPath),
            });
        } catch (error) {
            if (this.confirmUserCancellation(taskId, error)) {
                return;
            }

            const message = error instanceof Error ? error.message : String(error);
            this.dpTaskService.fail(taskId, {
                progress: `转换失败：${message}`,
                result: this.buildTaskResult(0, outputPaths.videoPath),
            });
        }
    }

    /**
     * 在目标文件不存在时执行视频转换。
     * @param taskId 转换任务 ID。
     * @param inputFile 待转换视频绝对路径。
     * @param outputFile HTML5 MP4 输出路径。
     * @param onProgress FFmpeg 进度回调。
     */
    private async convertVideoIfNeeded(
        taskId: number,
        inputFile: string,
        outputFile: string,
        onProgress: (progress: number) => void,
    ): Promise<void> {
        if (await this.hasNonEmptyFile(outputFile)) {
            return;
        }

        try {
            await this.ffmpegService.mkvToMp4({
                taskId,
                inputFile,
                outputFile,
                onProgress,
            });

            if (!await this.hasNonEmptyFile(outputFile)) {
                throw new Error(`视频转换未生成有效文件：${outputFile}`);
            }
        } catch (error) {
            await this.fileSystemGateway.removeFileIfExists(outputFile);
            throw error;
        }
    }

    /**
     * 尝试提取字幕；媒体中没有可用字幕时不影响视频转换结果。
     *
     * 先尝试英语字幕轨道，未生成有效文件时再尝试第一条字幕轨道。
     * 用户取消必须继续向上抛出，由任务流程标记为已取消。
     *
     * @param taskId 转换任务 ID。
     * @param inputFile 待转换视频绝对路径。
     * @param subtitleFile 字幕输出路径。
     * @param onProgress FFmpeg 进度回调。
     * @returns 成功生成非空字幕文件时返回 `true`。
     */
    private async extractSubtitleIfNeeded(
        taskId: number,
        inputFile: string,
        subtitleFile: string,
        onProgress: (progress: number) => void,
    ): Promise<boolean> {
        if (await this.hasNonEmptyFile(subtitleFile)) {
            return true;
        }

        try {
            await this.ffmpegService.extractSubtitles({
                taskId,
                inputFile,
                outputFile: subtitleFile,
                onProgress,
                en: true,
            });

            if (await this.hasNonEmptyFile(subtitleFile)) {
                return true;
            }

            await this.fileSystemGateway.removeFileIfExists(subtitleFile);
            await this.ffmpegService.extractSubtitles({
                taskId,
                inputFile,
                outputFile: subtitleFile,
                onProgress,
                en: false,
            });

            if (await this.hasNonEmptyFile(subtitleFile)) {
                return true;
            }

            await this.fileSystemGateway.removeFileIfExists(subtitleFile);
            return false;
        } catch (error) {
            await this.fileSystemGateway.removeFileIfExists(subtitleFile);
            if (error instanceof CancelByUserError) {
                throw error;
            }
            return false;
        }
    }

    /**
     * 判断路径是否指向非空文件。
     * @param filePath 文件绝对路径。
     * @returns 文件存在且大小大于零时返回 `true`。
     */
    private async hasNonEmptyFile(filePath: string): Promise<boolean> {
        if (!await this.fileSystemGateway.fileExists(filePath)) {
            return false;
        }
        return await this.fileSystemGateway.getFileSize(filePath) > 0;
    }

    /**
     * 确认异常是否来自当前任务的用户取消请求。
     * @param taskId 转换任务 ID。
     * @param error 转换流程捕获的异常。
     * @returns 任务已被标记为取消时返回 `true`。
     */
    private confirmUserCancellation(taskId: number, error: unknown): boolean {
        if (!(error instanceof CancelByUserError)) {
            return false;
        }

        try {
            this.dpTaskService.checkCancel(taskId);
        } catch (cancelError) {
            if (cancelError instanceof CancelByUserError) {
                return true;
            }
        }
        return false;
    }

    /**
     * 根据输入视频生成固定的转换输出路径。
     * @param inputFile 输入视频绝对路径。
     * @returns HTML5 MP4 和字幕输出路径。
     */
    private buildOutputPaths(inputFile: string): ConvertOutputPaths {
        const parsed = path.parse(inputFile);
        const baseName = parsed.name.endsWith('.html5')
            ? parsed.name.slice(0, -'.html5'.length)
            : parsed.name;
        const videoPath = path.join(parsed.dir, `${baseName}.html5.mp4`);
        return {
            videoPath,
            subtitlePath: path.join(parsed.dir, `${baseName}.html5.srt`),
        };
    }

    /**
     * 判断文件名是否为转换后的 HTML5 MP4。
     * @param filePath 文件绝对路径。
     * @returns 文件名以 `.html5.mp4` 结尾时返回 `true`。
     */
    private isHtml5Video(filePath: string): boolean {
        return path.basename(filePath).endsWith('.html5.mp4');
    }

    /**
     * 构建任务中心保存的转换结果。
     * @param progress 当前进度。
     * @param outputPath HTML5 MP4 输出路径。
     * @returns 序列化后的任务结果。
     */
    private buildTaskResult(progress: number, outputPath: string): string {
        return JSON.stringify({
            progress,
            path: outputPath,
        });
    }
}
