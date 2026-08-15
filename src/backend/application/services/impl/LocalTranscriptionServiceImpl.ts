// @/backend/services/impl/LocalTranscriptionServiceImpl.ts
import {injectable, inject} from 'inversify';
import {TranscriptionService} from '@/backend/application/services/TranscriptionService';
import RendererGateway from '@/backend/application/ports/gateways/renderer/RendererGateway';
import TYPES from '@/backend/ioc/types';
import * as path from 'path';
import FfmpegService from '@/backend/application/services/FfmpegService';
import {getMainLogger} from '@/backend/infrastructure/logger';
import objectHash from 'object-hash';
import SrtUtil from '@/common/utils/SrtUtil';
import SpeechRecognitionGateway, {
    SpeechRecognitionResult,
    SpeechRecognitionToken,
} from '@/backend/application/ports/gateways/media/SpeechRecognitionGateway';
import StorageDirectoryProvider, {
    StorageDirectoryTarget,
} from '@/backend/application/ports/gateways/storage/StorageDirectoryProvider';
import FileSystemGateway from '@/backend/application/ports/gateways/storage/FileSystemGateway';
import EnglishSubtitleSegmenter from '@/backend/application/kernel/subtitle/EnglishSubtitleSegmenter';
import { concurrency } from '@/backend/application/kernel/concurrency';
import { TranscriptTaskResult, TranscriptTaskState } from '@/common/contracts/transcript/transcript-task';

/** 单段识别失败时的最大重试次数。 */
const MAX_CHUNK_RETRY = 2;

/** 相邻音频分段的语音重叠时长（秒），用于避免切分边界切到单词。 */
const CHUNK_OVERLAP_SECONDS = 1;

@injectable()
export class LocalTranscriptionServiceImpl implements TranscriptionService {
    // 记录每个文件的 Promise 控制器
    private deferred = new Map<string, { resolve: () => void; reject: (error: unknown) => void }>();

    // 记录每个文件对应的取消信号控制器
    private abortControllers = new Map<string, AbortController>();

    // 当前正在识别（或准备识别）的文件路径
    private activeFilePath: string | null = null;

    // 记录任务真正开始处理的时间，用于生成简短的累计秒数提示。
    private transcriptionStartedAt = new Map<string, number>();

    private logger = getMainLogger('LocalTranscriptionService');

    constructor(
        @inject(TYPES.FfmpegService) private ffmpegService: FfmpegService,
        @inject(TYPES.RendererGateway) private rendererGateway: RendererGateway,
        @inject(TYPES.SpeechRecognitionGateway) private speechRecognitionGateway: SpeechRecognitionGateway,
        @inject(TYPES.StorageDirectoryProvider) private storageDirectoryProvider: StorageDirectoryProvider,
        @inject(TYPES.FileSystemGateway) private fileSystemGateway: FileSystemGateway,
    ) {}

    private readonly subtitleSegmenter = new EnglishSubtitleSegmenter();

    /**
     * 向渲染进程发送转录任务状态，处理中仅向用户展示百分比与累计秒数。
     * @param taskId 任务标识；当前本地转录固定为 0。
     * @param filePath 被转录的媒体路径。
     * @param status 任务状态。
     * @param progress 整体进度百分比。
     * @param result 可选的消息、错误或字幕路径。
     */
    private sendProgress(
        taskId: number,
        filePath: string,
        status: TranscriptTaskState,
        progress: number,
        result?: TranscriptTaskResult,
    ): void {
        const finalResult = { ...result };
        if (status === TranscriptTaskState.INIT) {
            this.transcriptionStartedAt.set(filePath, Date.now());
            finalResult.message = `${progress}%（0秒）`;
        } else if (status === TranscriptTaskState.IN_PROGRESS) {
            const startedAt = this.transcriptionStartedAt.get(filePath);
            const elapsedSeconds = startedAt === undefined ? 0 : Math.floor((Date.now() - startedAt) / 1000);
            finalResult.message = `${progress}%（${elapsedSeconds}秒）`;
        } else {
            this.transcriptionStartedAt.delete(filePath);
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
     * 将文件加入本地转录队列，同一时间只处理一个文件。
     * @param filePath 待转录媒体的绝对路径。
     */
    public async transcribe(filePath: string): Promise<void> {
        if (this.deferred.has(filePath)) {
            this.sendProgress(0, filePath, TranscriptTaskState.FAILED, 0, {
                message: '该文件已在转录队列中或正在处理'
            });
            throw new Error('File already in queue or processing');
        }

        return await new Promise<void>((resolve, reject) => {
            const controller = new AbortController();
            this.deferred.set(filePath, { resolve, reject });
            this.abortControllers.set(filePath, controller);

            concurrency.withMutex('transcription', async () => {
                // 若在排队等待期间被取消，不再执行转录。
                if (controller.signal.aborted) {
                    throw new Error('Transcription cancelled by user');
                }
                if (this.deferred.size > 1) {
                    this.sendProgress(0, filePath, TranscriptTaskState.IN_PROGRESS, 0, {
                        message: '已加入队列，等待前一个文件转录完成...'
                    });
                }
                this.activeFilePath = filePath;
                await this.doTranscribe(filePath, controller.signal);
            }, { signal: controller.signal }).catch((error) => {
                // mutex 等待期间取消会抛 ConcurrencyCancelledError，统一按取消处理。
                if (controller.signal.aborted) {
                    throw new Error('Transcription cancelled by user');
                }
                throw error;
            }).then(
                () => {
                    this.deferred.delete(filePath);
                    this.abortControllers.delete(filePath);
                    resolve();
                },
                (error: unknown) => {
                    this.deferred.delete(filePath);
                    this.abortControllers.delete(filePath);
                    reject(error);
                },
            );
        });
    }

    /**
     * 执行单个文件的完整转录流程并负责临时目录清理。
     * @param filePath 待转录媒体的绝对路径。
     * @param signal 取消信号；触发后任务应在最近的检查点退出。
     */
    private async doTranscribe(filePath: string, signal: AbortSignal): Promise<void> {
        let tempFolder: string | null = null;

        try {
            await this.storageDirectoryProvider.ensurePathAccessPermissionIfExists(filePath);
            // 开始
            this.sendProgress(0, filePath, TranscriptTaskState.INIT, 0);
            if (signal.aborted) throw new Error('Transcription cancelled by user');

            // 临时目录
            // 包含时间戳，避免同一文件并发任务相互覆盖
            const folderName = objectHash(`${filePath}::${Date.now()}`);
            const tempRoot = await this.storageDirectoryProvider.provideDirectory(StorageDirectoryTarget.TEMP);
            tempFolder = path.join(tempRoot, 'parakeet', folderName);
            await this.fileSystemGateway.ensureDirectory(tempFolder);

            await this.transcribeWithSherpaOnnx({
                filePath,
                tempFolder,
                signal,
            });
            return;

        } catch (error) {
            if (signal.aborted) {
                this.sendProgress(0, filePath, TranscriptTaskState.CANCELLED, 0, { message: '转录任务已取消' });
            } else {
                this.sendProgress(0, filePath, TranscriptTaskState.FAILED, 0, { error: error instanceof Error ? error.message : String(error) });
            }
            throw error;
        } finally {
            // 清理临时文件
            try {
                if (tempFolder) await this.fileSystemGateway.removeDirectoryIfExists(tempFolder);
            } catch (cleanupError) {
                this.logger.warn('Failed to cleanup temporary files', {cleanupError});
            }
            this.activeFilePath = null;
        }
    }

    /**
     * 使用 sherpa-onnx 与 Parakeet v3 执行英语识别，并生成适合播放器展示的 SRT。
     * @param opts 转录所需的输入路径、临时目录与取消信号。
     */
    private async transcribeWithSherpaOnnx(opts: { filePath: string; tempFolder: string; signal: AbortSignal }): Promise<void> {
        const { filePath, tempFolder, signal } = opts;
        const modelsRoot = await this.storageDirectoryProvider.provideDirectory(StorageDirectoryTarget.MODELS);
        this.sendProgress(0, filePath, TranscriptTaskState.IN_PROGRESS, 10, { message: '正在切分长音频...' });
        if (signal.aborted) throw new Error('Transcription cancelled by user');
        const duration = await this.ffmpegService.duration(filePath);
        if (!Number.isFinite(duration) || duration <= 0) throw new Error(`无法读取音频时长：${duration}`);

        const chunkDuration = 2 * 60;
        const ranges: Array<{ start: number; end: number }> = [];
        for (let start = 0; start < duration; start += chunkDuration) {
            // 非首段向前多留出重叠区，保证切分边界处的单词完整出现在相邻两段中。
            const overlapStart = Math.max(0, start - CHUNK_OVERLAP_SECONDS);
            ranges.push({ start: overlapStart, end: Math.min(duration, start + chunkDuration) });
        }
        const wavPaths = await this.ffmpegService.createRecognitionWavChunks({
            inputFile: filePath,
            ranges,
            outputFolder: tempFolder,
        });
        this.sendProgress(0, filePath, TranscriptTaskState.IN_PROGRESS, 35);

        const chunkTimelines: SpeechRecognitionToken[][] = [];
        for (let index = 0; index < wavPaths.length; index++) {
            if (signal.aborted) throw new Error('Transcription cancelled by user');
            // 进度从 35% 起步，覆盖到 100%，并留出整理字幕的最后一步。
            const progress = Math.min(90, 35 + Math.floor(index / Math.max(wavPaths.length, 1) * 55));
            this.sendProgress(0, filePath, TranscriptTaskState.IN_PROGRESS, progress);
            const offset = ranges[index].start;
            const result = await this.transcribeChunkWithRetry({
                wavPath: wavPaths[index],
                modelsRoot,
                signal,
                filePath,
                progress,
            });
            chunkTimelines.push(result.tokens.map((token) => ({ ...token, start: token.start + offset })));
        }
        if (signal.aborted) throw new Error('Transcription cancelled by user');
        this.sendProgress(0, filePath, TranscriptTaskState.IN_PROGRESS, 95, { message: '整理字幕文件...' });
        const lines = this.subtitleSegmenter.segment(
            chunkTimelines,
            ranges.map((range) => range.start),
        );
        if (lines.length === 0) throw new Error('Parakeet v3 未识别出可用字幕');
        const finalSrt = SrtUtil.srtLinesToSrt(lines, { reindex: true });
        const srtFileName = filePath.replace(/\.[^/.]+$/, '') + '.srt';
        await this.storageDirectoryProvider.ensurePathAccessPermissionIfExists(srtFileName);
        await this.fileSystemGateway.writeTextFile(srtFileName, finalSrt);

        this.sendProgress(0, filePath, TranscriptTaskState.DONE, 100, { srtPath: srtFileName });
    }

    /**
     * 识别单个音频分段；失败时按取消状态区分重试与直接退出。
     * @param opts 音频分段、模型目录、取消信号与进度信息。
     * @returns 识别结果；重试耗尽后抛出最后一次的错误。
     */
    private async transcribeChunkWithRetry(opts: {
        wavPath: string;
        modelsRoot: string;
        signal: AbortSignal;
        filePath: string;
        progress: number;
    }): Promise<SpeechRecognitionResult> {
        const { wavPath, modelsRoot, signal, filePath, progress } = opts;
        for (let attempt = 1; attempt <= MAX_CHUNK_RETRY; attempt++) {
            if (signal.aborted) throw new Error('Transcription cancelled by user');
            try {
                // whisper 信号量统一限制识别任务并发；未配置时跳过锁顺序校验。
                return await concurrency.withSemaphore('whisper', async () => {
                    return await this.speechRecognitionGateway.transcribe({
                        audioPath: wavPath,
                        modelsRoot,
                        isCancelled: () => signal.aborted,
                        onHeartbeat: () => {
                            this.sendProgress(0, filePath, TranscriptTaskState.IN_PROGRESS, progress);
                        },
                    });
                }, { skipOrderCheck: true });
            } catch (error) {
                if (signal.aborted) {
                    // 主动取消：不再重试。
                    throw new Error('Transcription cancelled by user');
                }
                const message = error instanceof Error ? error.message : String(error);
                if (attempt >= MAX_CHUNK_RETRY) {
                    this.logger.error('Chunk transcription failed after retries', { wavPath, attempt, message });
                    throw error;
                }
                this.logger.warn('Chunk transcription failed, retrying', { wavPath, attempt, message });
            }
        }
        // 仅当 MAX_CHUNK_RETRY 为 0 时到达；保持类型完整。
        throw new Error('Chunk transcription failed');
    }

    /**
     * 取消排队中或正在识别的文件；任务在最近的检查点退出。
     * @param filePath 目标媒体路径。
     * @returns 找到并取消任务时返回 true。
     */
    public cancel(filePath: string): boolean {
        if (this.deferred.has(filePath)) {
            // 触发取消信号：正在排队等待的任务会直接退出，正在识别的任务会中止循环并在检查点退出。
            this.abortControllers.get(filePath)?.abort();
            // 目标是当前正在识别的任务时，再终止底层识别进程以缩短等待时间。
            if (this.activeFilePath === filePath) {
                this.speechRecognitionGateway.cancelActive();
            }
            return true;
        }
        return false;
    }
}
