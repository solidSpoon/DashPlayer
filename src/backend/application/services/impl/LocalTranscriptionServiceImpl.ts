// @/backend/services/impl/LocalTranscriptionServiceImpl.ts
import {injectable, inject} from 'inversify';
import {TranscriptionService} from '@/backend/application/services/TranscriptionService';
import RendererGateway from '@/backend/application/ports/gateways/renderer/RendererGateway';
import TYPES from '@/backend/ioc/types';
import * as path from 'path';
import * as fsPromises from 'fs/promises';
import FfmpegService from '@/backend/application/services/FfmpegService';
import {getMainLogger} from '@/backend/infrastructure/logger';
import objectHash from 'object-hash';
import SrtUtil from '@/common/utils/SrtUtil';
import {DpTaskState} from "@/backend/infrastructure/db/tables/dpTask";
import SpeechRecognitionGateway, { SpeechRecognitionToken } from '@/backend/application/ports/gateways/media/SpeechRecognitionGateway';
import StorageDirectoryProvider, {
    StorageDirectoryTarget,
} from '@/backend/application/ports/gateways/storage/StorageDirectoryProvider';
import EnglishSubtitleSegmenter from '@/backend/application/kernel/subtitle/EnglishSubtitleSegmenter';

@injectable()
export class LocalTranscriptionServiceImpl implements TranscriptionService {
    // 当前正在处理的文件路径
    private activeFilePath: string | null = null;

    // 被请求取消的文件集合
    private cancelled = new Set<string>();

    // 队列：一次只处理一个任务
    private processing = false;
    private queue: Array<string> = [];

    // 记录每个文件的 Promise 控制器
    private deferred = new Map<string, { resolve: () => void; reject: (error: unknown) => void }>();

    private logger = getMainLogger('LocalTranscriptionService');

    constructor(
        @inject(TYPES.FfmpegService) private ffmpegService: FfmpegService,
        @inject(TYPES.RendererGateway) private rendererGateway: RendererGateway,
        @inject(TYPES.SpeechRecognitionGateway) private speechRecognitionGateway: SpeechRecognitionGateway,
        @inject(TYPES.StorageDirectoryProvider) private storageDirectoryProvider: StorageDirectoryProvider,
    ) {}

    private readonly subtitleSegmenter = new EnglishSubtitleSegmenter();

    /**
     * 向渲染进程发送转录任务状态，并把百分比写入用户可见消息。
     * @param taskId 任务标识；当前本地转录固定为 0。
     * @param filePath 被转录的媒体路径。
     * @param status 任务状态。
     * @param progress 整体进度百分比。
     * @param result 可选的消息、错误或字幕路径。
     */
    private sendProgress(
        taskId: number,
        filePath: string,
        status: string,
        progress: number,
        result?: Record<string, unknown>,
    ): void {
        // 将进度信息合并到 message 字段中
        const finalResult = result || {};
        if (progress !== undefined && progress !== null) {
            finalResult.message = `[${progress}%] ${finalResult.message || ''}`.trim();
        }

        this.rendererGateway.fireAndForget('transcript/batch-result', {
            updates: [{
                filePath,
                taskId,
                status,
                result: finalResult
            }]
        });
    }

    /**
     * 将文件加入串行本地转录队列。
     * @param filePath 待转录媒体的绝对路径。
     */
    public async transcribe(filePath: string): Promise<void> {
        return new Promise<void>((resolve, reject) => {
            // 检查是否已经在队列中或正在处理
            if (this.queue.includes(filePath) || this.activeFilePath === filePath) {
                this.sendProgress(0, filePath, DpTaskState.FAILED, 0, {
                    message: '该文件已在转录队列中或正在处理'
                });
                reject(new Error('File already in queue or processing'));
                return;
            }

            // 为该文件保存回调
            this.deferred.set(filePath, { resolve, reject });

            // 将文件加入队列
            this.queue.push(filePath);

            // 如果当前已在处理任务，则提示排队
            if (this.processing || this.activeFilePath !== null || this.queue.length > 1) {
                this.sendProgress(0, filePath, DpTaskState.IN_PROGRESS, 0, {
                    message: '已加入队列，等待前一个文件转录完成...'
                });
            }

            // 触发队列处理
            this.pump().catch(err => this.logger.error('pump failed', { err }));
        });
    }

    /** 串行消费队列；单个任务失败不会阻止后续任务。 */
    private async pump(): Promise<void> {
        if (this.processing) return;

        const next = this.queue.shift();
        if (!next) return;

        this.processing = true;
        const filePath = next;

        try {
            await this.doTranscribe(filePath);
            this.deferred.get(filePath)?.resolve();
        } catch (e) {
            this.deferred.get(filePath)?.reject(e);
        } finally {
            this.deferred.delete(filePath);
            this.cancelled.delete(filePath); // 清理取消标记
            this.processing = false;

            // 继续下一个
            await this.pump();
        }
    }

    /**
     * 执行单个文件的完整转录流程并负责临时目录清理。
     * @param filePath 待转录媒体的绝对路径。
     */
    private async doTranscribe(filePath: string): Promise<void> {
        this.activeFilePath = filePath;

        let tempFolder: string | null = null;

        try {
            await this.storageDirectoryProvider.ensurePathAccessPermissionIfExists(filePath);
            // 开始
            this.sendProgress(0, filePath, DpTaskState.INIT, 0);
            if (this.isCancelled(filePath)) throw new Error('Transcription cancelled by user');

            // 临时目录
            // 包含时间戳，避免同一文件并发任务相互覆盖
            const folderName = objectHash(`${filePath}::${Date.now()}`);
            const tempRoot = await this.storageDirectoryProvider.provideDirectory(StorageDirectoryTarget.TEMP);
            tempFolder = path.join(tempRoot, 'parakeet', folderName);
            await fsPromises.mkdir(tempFolder, {recursive: true});

            await this.transcribeWithSherpaOnnx({
                filePath,
                tempFolder,
            });
            return;

        } catch (error) {
            if (this.isCancelled(filePath)) {
                this.sendProgress(0, filePath, DpTaskState.CANCELLED, 0, { message: '转录任务已取消' });
            } else {
                this.sendProgress(0, filePath, DpTaskState.FAILED, 0, { error: error instanceof Error ? error.message : String(error) });
            }
            throw error;
        } finally {
            this.activeFilePath = null;

            // 清理临时文件
            try {
                if (tempFolder) await fsPromises.rm(tempFolder, {recursive: true, force: true});
            } catch (cleanupError) {
                this.logger.warn('Failed to cleanup temporary files', {cleanupError});
            }
        }
    }

    /**
     * 使用 sherpa-onnx 与 Parakeet v3 执行英语识别，并生成适合播放器展示的 SRT。
     * @param opts 转录所需的输入路径与临时目录。
     */
    private async transcribeWithSherpaOnnx(opts: { filePath: string; tempFolder: string }): Promise<void> {
        const { filePath, tempFolder } = opts;
        const modelsRoot = await this.storageDirectoryProvider.provideDirectory(StorageDirectoryTarget.MODELS);
        this.sendProgress(0, filePath, DpTaskState.IN_PROGRESS, 10, { message: '正在切分长音频...' });
        if (this.isCancelled(filePath)) throw new Error('Transcription cancelled by user');
        const duration = await this.ffmpegService.duration(filePath);
        if (!Number.isFinite(duration) || duration <= 0) throw new Error(`无法读取音频时长：${duration}`);

        const chunkDuration = 5 * 60;
        const ranges: Array<{ start: number; end: number }> = [];
        for (let start = 0; start < duration; start += chunkDuration) {
            ranges.push({ start, end: Math.min(duration, start + chunkDuration) });
        }
        const wavPaths = await this.ffmpegService.createRecognitionWavChunks({
            inputFile: filePath,
            ranges,
            outputFolder: tempFolder,
        });
        this.sendProgress(0, filePath, DpTaskState.IN_PROGRESS, 35, { message: `已准备 ${wavPaths.length} 个识别片段` });

        const timeline: SpeechRecognitionToken[] = [];
        for (let index = 0; index < wavPaths.length; index++) {
            if (this.isCancelled(filePath)) throw new Error('Transcription cancelled by user');
            const completedDuration = ranges[index].start;
            const progress = Math.min(90, Math.floor(35 + completedDuration / duration * 55));
            const recognitionStartedAt = Date.now();
            this.sendProgress(0, filePath, DpTaskState.IN_PROGRESS, progress, {
                message: `Parakeet v3 正在识别第 ${index + 1}/${wavPaths.length} 段`,
            });
            const result = await this.speechRecognitionGateway.transcribe({
                audioPath: wavPaths[index],
                modelsRoot,
                isCancelled: () => this.isCancelled(filePath),
                onHeartbeat: () => {
                    const elapsedSeconds = Math.floor((Date.now() - recognitionStartedAt) / 1000);
                    const elapsedText = elapsedSeconds >= 60
                        ? `${Math.floor(elapsedSeconds / 60)} 分 ${elapsedSeconds % 60} 秒`
                        : `${elapsedSeconds} 秒`;
                    this.sendProgress(0, filePath, DpTaskState.IN_PROGRESS, progress, {
                        message: `Parakeet v3 正在识别第 ${index + 1}/${wavPaths.length} 段，已运行 ${elapsedText}`,
                    });
                },
            });
            const offset = ranges[index].start;
            timeline.push(...result.tokens.map((token) => ({ ...token, start: token.start + offset })));

            const completedProgress = Math.min(90, Math.floor(35 + ranges[index].end / duration * 55));
            this.sendProgress(0, filePath, DpTaskState.IN_PROGRESS, completedProgress, {
                message: `已完成 ${index + 1}/${wavPaths.length} 段`,
            });
        }
        if (this.isCancelled(filePath)) throw new Error('Transcription cancelled by user');
        this.sendProgress(0, filePath, DpTaskState.IN_PROGRESS, 95, { message: '整理字幕文件...' });
        const lines = this.subtitleSegmenter.segment(timeline);
        if (lines.length === 0) throw new Error('Parakeet v3 未识别出可用字幕');
        const finalSrt = SrtUtil.srtLinesToSrt(lines, { reindex: true });
        const srtFileName = filePath.replace(/\.[^/.]+$/, '') + '.srt';
        await this.storageDirectoryProvider.ensurePathAccessPermissionIfExists(srtFileName);
        await fsPromises.writeFile(srtFileName, finalSrt);

        this.sendProgress(0, filePath, DpTaskState.DONE, 100, { srtPath: srtFileName });
    }

    /**
     * 取消排队中或正在识别的文件。
     * @param filePath 目标媒体路径。
     * @returns 找到并取消任务时返回 true。
     */
    public cancel(filePath: string): boolean {
        // 标记为已取消
        this.cancelled.add(filePath);

        // 如果在排队中，直接移出队列并回调
        const idx = this.queue.indexOf(filePath);
        if (idx >= 0) {
            this.queue.splice(idx, 1);
            try {
                this.sendProgress(0, filePath, DpTaskState.CANCELLED, 0, { message: '转录任务已取消（尚未开始）' });
            } catch {
                //
            }
            this.deferred.get(filePath)?.reject(new Error('Transcription cancelled by user'));
            this.deferred.delete(filePath);
            this.cancelled.delete(filePath);
            return true;
        }

        // 如果是当前任务，doTranscribe 会在检查点自行退出
        if (this.activeFilePath === filePath) {
            this.speechRecognitionGateway.cancelActive();
            return true;
        }

        // 任务不存在，清理取消标记并返回 false
        this.cancelled.delete(filePath);
        return false;
    }

    /**
     * 判断文件是否收到取消请求。
     * @param filePath 目标媒体路径。
     */
    private isCancelled(filePath: string): boolean {
        return this.cancelled.has(filePath);
    }

}
