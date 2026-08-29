// @/backend/services/impl/LocalTranscriptionServiceImpl.ts
import {injectable, inject} from 'inversify';
import RendererGateway from '@/backend/services/gateways/renderer/RendererGateway';
import TYPES from '@/backend/ioc/types';
import * as path from 'path';
import FfmpegService from '@/backend/services/FfmpegService';
import {getMainLogger} from '@/backend/infrastructure/logger';
import objectHash from 'object-hash';
import SrtUtil from '@/common/utils/SrtUtil';
import SpeechRecognitionGateway, {
    SpeechRecognitionResult,
    SpeechRecognitionToken,
} from '@/backend/services/gateways/media/SpeechRecognitionGateway';
import StorageDirectoryProvider, {
    StorageDirectoryTarget,
} from '@/backend/services/gateways/storage/StorageDirectoryProvider';
import FileSystemGateway from '@/backend/services/gateways/storage/FileSystemGateway';
import EnglishSubtitleSegmenter from '@/backend/utils/subtitle/EnglishSubtitleSegmenter';
import { concurrency } from '@/backend/utils/concurrency';
import {
    TranscriptTask,
    TranscriptTaskResult,
    TranscriptTaskState,
} from '@/common/contracts/transcript/transcript-task';
import TranscriptionTaskRepository from '@/backend/services/repositories/TranscriptionTaskRepository';
import { TranscriptChunkResult } from '@/common/contracts/transcript/transcript-task';

/**
 * 本地转录任务的持久化、排队、执行与取消契约。
 */
export interface TranscriptionService {
    /**
     * 查询持久化的转录任务列表。
     *
     * @returns 按入队顺序排列的转录任务。
     */
    listTasks(): Promise<TranscriptTask[]>;

    /**
     * 将文件加入转录列表；同一路径只保留一条任务。
     *
     * @param filePath 待转录媒体的绝对路径。
     * @returns 新建或已存在的任务。
     */
    enqueue(filePath: string): Promise<TranscriptTask>;

    /**
     * 从转录列表删除未执行中的任务。
     *
     * @param filePath 待删除媒体的绝对路径。
     */
    remove(filePath: string): Promise<void>;

    /**
     * 将应用重启前未完成的任务标记为中断。
     */
    recoverInterruptedTasks(): Promise<void>;

    /**
     * 写入任务状态并通知 renderer。
     *
     * @param filePath 任务文件路径。
     * @param status 目标状态。
     * @param result 状态说明。
     */
    updateTask(filePath: string, status: TranscriptTaskState, result: TranscriptTaskResult): Promise<void>;

    /**
     * 开始转录任务
     * @param filePath 音频/视频文件路径
     */
    transcribe(filePath: string, currentPosition?: number): Promise<void>;
    updateDemand(filePath: string, currentPosition: number): void;
    getSessionSnapshot(filePath: string): { sessionId: string; chunks: TranscriptChunkResult[] } | null;
    
    /**
     * 取消转录任务
     * @param filePath 文件路径
     * @returns 是否成功取消
     */
    cancel(filePath: string): boolean;
}

/** 单段识别失败时的最大重试次数。 */
const MAX_CHUNK_RETRY = 2;

/** 相邻音频分段的语音重叠时长（秒），用于避免切分边界切到单词。 */
const CHUNK_OVERLAP_SECONDS = 1;

/**
 * 使用后端数据库维护转录列表，并通过并发内核串行执行本地识别任务。
 */
@injectable()
export class LocalTranscriptionServiceImpl implements TranscriptionService {
    /** 运行中的增量转录会话；仅用于当前主进程生命周期。 */
    private sessions = new Map<string, { sessionId: string; currentPosition: number; chunks: Map<number, TranscriptChunkResult> }>();
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
        @inject(TYPES.TranscriptionTaskRepository) private transcriptionTaskRepository: TranscriptionTaskRepository,
    ) {}

    private readonly subtitleSegmenter = new EnglishSubtitleSegmenter();

    /**
     * 校验并归一化媒体绝对路径，确保数据库唯一索引和内存队列使用同一键。
     *
     * @param filePath 调用方传入的媒体路径。
     * @returns 归一化后的绝对路径。
     */
    private normalizeFilePath(filePath: string): string {
        if (!path.isAbsolute(filePath)) {
            throw new Error(`转录文件路径必须是绝对路径: ${filePath}`);
        }
        return path.normalize(filePath);
    }

    /**
     * 向渲染进程发送转录任务状态，处理中仅向用户展示百分比与累计秒数。
     * @param taskId 任务标识；当前本地转录固定为 0。
     * @param filePath 被转录的媒体路径。
     * @param status 任务状态。
     * @param progress 整体进度百分比。
     * @param result 可选的消息、错误或字幕路径。
     */
    private async sendProgress(
        taskId: number,
        filePath: string,
        status: TranscriptTaskState,
        progress: number,
        result?: TranscriptTaskResult,
    ): Promise<void> {
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

        await this.transcriptionTaskRepository.updateByFilePath(filePath, {
            status,
            result: finalResult,
        });
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
     * 查询后端持久化的转录任务列表。
     *
     * @returns 当前全部转录任务。
     */
    public listTasks(): Promise<TranscriptTask[]> {
        return this.transcriptionTaskRepository.list();
    }

    /**
     * 将视频加入后端转录列表，并由数据库唯一索引执行去重。
     *
     * @param filePath 待转录媒体的绝对路径。
     * @returns 新建或已存在的转录任务。
     */
    public async enqueue(filePath: string): Promise<TranscriptTask> {
        const normalizedFilePath = this.normalizeFilePath(filePath);
        return this.transcriptionTaskRepository.createIfAbsent({ filePath: normalizedFilePath });
    }

    /**
     * 删除未进入执行阶段的转录任务。
     *
     * @param filePath 待删除媒体的绝对路径。
     * @throws 任务正在排队或执行时抛出，要求调用方先取消任务。
     */
    public async remove(filePath: string): Promise<void> {
        const normalizedFilePath = this.normalizeFilePath(filePath);
        if (this.deferred.has(normalizedFilePath)) {
            throw new Error(`转录任务正在执行，不能删除: ${normalizedFilePath}`);
        }
        await this.transcriptionTaskRepository.deleteByFilePath(normalizedFilePath);
    }

    /**
     * 清理应用重启前遗留的未完成任务状态。
     */
    public recoverInterruptedTasks(): Promise<void> {
        return this.transcriptionTaskRepository.markActiveAsInterrupted();
    }

    /**
     * 写入转录任务状态并向 renderer 推送最新状态。
     *
     * @param filePath 任务文件路径。
     * @param status 目标状态。
     * @param result 状态说明。
     */
    public updateTask(
        filePath: string,
        status: TranscriptTaskState,
        result: TranscriptTaskResult,
    ): Promise<void> {
        return this.sendProgress(0, this.normalizeFilePath(filePath), status, 0, result);
    }

    /**
     * 将文件加入本地转录队列，同一时间只处理一个文件。
     * @param filePath 待转录媒体的绝对路径。
     */
    public async transcribe(filePath: string, currentPosition = 0): Promise<void> {
        const normalizedFilePath = this.normalizeFilePath(filePath);
        if (this.deferred.has(normalizedFilePath)) {
            throw new Error('File already in queue or processing');
        }

        let resolveTask!: () => void;
        let rejectTask!: (error: unknown) => void;
        const taskPromise = new Promise<void>((resolve, reject) => {
            resolveTask = resolve;
            rejectTask = reject;
        });

        const controller = new AbortController();
        this.sessions.set(normalizedFilePath, { sessionId: objectHash(`${normalizedFilePath}:${Date.now()}`), currentPosition, chunks: new Map() });
        this.deferred.set(normalizedFilePath, { resolve: resolveTask, reject: rejectTask });
        this.abortControllers.set(normalizedFilePath, controller);

        try {
            // 先落库再等待互斥锁，确保排队任务立即呈现在所有前端入口。
            await this.sendProgress(0, normalizedFilePath, TranscriptTaskState.INIT, 0);
        } catch (error) {
            this.deferred.delete(normalizedFilePath);
            this.abortControllers.delete(normalizedFilePath);
            throw error;
        }

        concurrency.withMutex('transcription', async () => {
            // 若在排队等待期间被取消，不再执行转录。
            if (controller.signal.aborted) {
                throw new Error('Transcription cancelled by user');
            }
            this.activeFilePath = normalizedFilePath;
            await this.doTranscribe(normalizedFilePath, controller.signal);
        }, { signal: controller.signal }).catch(async (error) => {
            // 在队列等待或实际执行期间取消，都统一持久化为 cancelled。
            if (controller.signal.aborted) {
                await this.sendProgress(0, normalizedFilePath, TranscriptTaskState.CANCELLED, 0, {
                    message: '转录任务已取消',
                });
                throw new Error('Transcription cancelled by user');
            }

            await this.sendProgress(0, normalizedFilePath, TranscriptTaskState.FAILED, 0, {
                error: error instanceof Error ? error.message : String(error),
            });
            throw error;
        }).then(
            () => {
                this.deferred.delete(normalizedFilePath);
                this.abortControllers.delete(normalizedFilePath);
                resolveTask();
            },
            (error: unknown) => {
                this.deferred.delete(normalizedFilePath);
                this.abortControllers.delete(normalizedFilePath);
                rejectTask(error);
            },
        );

        return taskPromise;
    }

    /** 更新尚未开始的块的调度位置；当前识别块不会被中断。 */
    public updateDemand(filePath: string, currentPosition: number): void {
        const session = this.sessions.get(this.normalizeFilePath(filePath));
        if (session && Number.isFinite(currentPosition)) session.currentPosition = Math.max(0, currentPosition);
    }

    /** 返回当前会话已完成的增量块，供页面重新进入时恢复。 */
    public getSessionSnapshot(filePath: string): { sessionId: string; chunks: TranscriptChunkResult[] } | null {
        const session = this.sessions.get(this.normalizeFilePath(filePath));
        if (!session) return null;
        return { sessionId: session.sessionId, chunks: Array.from(session.chunks.values()).sort((a, b) => a.chunkIndex - b.chunkIndex) };
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
            await this.sendProgress(0, filePath, TranscriptTaskState.INIT, 0);
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

        } finally {
            // 清理临时文件
            try {
                if (tempFolder) await this.fileSystemGateway.removeDirectoryIfExists(tempFolder);
            } catch (cleanupError) {
                this.logger.warn('Failed to cleanup temporary files', {cleanupError});
            }
            this.activeFilePath = null;
            this.sessions.delete(filePath);
        }
    }

    /**
     * 使用 sherpa-onnx 与 Parakeet v3 执行英语识别，并生成适合播放器展示的 SRT。
     * @param opts 转录所需的输入路径、临时目录与取消信号。
     */
    private async transcribeWithSherpaOnnx(opts: { filePath: string; tempFolder: string; signal: AbortSignal }): Promise<void> {
        const { filePath, tempFolder, signal } = opts;
        const modelsRoot = await this.storageDirectoryProvider.provideDirectory(StorageDirectoryTarget.MODELS);
        await this.sendProgress(0, filePath, TranscriptTaskState.IN_PROGRESS, 10, { message: '正在切分长音频...' });
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
        await this.sendProgress(0, filePath, TranscriptTaskState.IN_PROGRESS, 35);

        const chunkTimelines: SpeechRecognitionToken[][] = Array.from({ length: wavPaths.length }, () => []);
        const session = this.sessions.get(filePath);
        const order = wavPaths.map((_, index) => index).sort((a, b) => {
            const position = session?.currentPosition ?? 0;
            const distance = (index: number) => ranges[index].end <= position ? Number.MAX_SAFE_INTEGER : Math.abs(ranges[index].start - position);
            return distance(a) - distance(b);
        });
        for (let processed = 0; processed < order.length; processed++) {
            const index = order[processed];
            if (signal.aborted) throw new Error('Transcription cancelled by user');
            // 进度从 35% 起步，覆盖到 100%，并留出整理字幕的最后一步。
            const progress = Math.min(90, 35 + Math.floor(processed / Math.max(order.length, 1) * 55));
            await this.sendProgress(0, filePath, TranscriptTaskState.IN_PROGRESS, progress);
            const offset = ranges[index].start;
            const result = await this.transcribeChunkWithRetry({
                wavPath: wavPaths[index],
                modelsRoot,
                signal,
                filePath,
                progress,
            });
            const timeline = result.tokens.map((token) => ({ ...token, start: token.start + offset }));
            chunkTimelines[index] = timeline;
            const lines = this.subtitleSegmenter.segment([timeline], [ranges[index].start]);
            if (session) {
                // 增量阶段使用全局稳定序号，避免各块的局部字幕序号互相覆盖。
                const chunk: TranscriptChunkResult = { filePath, chunkIndex: index, start: ranges[index].start, end: ranges[index].end, sentences: lines.map((line) => ({ ...line, index: index * 100000 + line.index })) };
                session.chunks.set(index, chunk);
                this.rendererGateway.fireAndForget('transcript/chunk-result', { ...chunk, sessionId: session.sessionId, isFinal: false });
            }
        }
        if (signal.aborted) throw new Error('Transcription cancelled by user');
        await this.sendProgress(0, filePath, TranscriptTaskState.IN_PROGRESS, 95, { message: '整理字幕文件...' });
        const lines = this.subtitleSegmenter.segment(
            chunkTimelines,
            ranges.map((range) => range.start),
        );
        if (lines.length === 0) throw new Error('Parakeet v3 未识别出可用字幕');
        const finalSrt = SrtUtil.srtLinesToSrt(lines, { reindex: true });
        const srtFileName = filePath.replace(/\.[^/.]+$/, '') + '.srt';
        await this.storageDirectoryProvider.ensurePathAccessPermissionIfExists(srtFileName);
        await this.fileSystemGateway.writeTextFile(srtFileName, finalSrt);

        await this.sendProgress(0, filePath, TranscriptTaskState.DONE, 100, { srtPath: srtFileName });
        this.sessions.delete(filePath);
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
                            void this.sendProgress(0, filePath, TranscriptTaskState.IN_PROGRESS, progress);
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
        const normalizedFilePath = this.normalizeFilePath(filePath);
        if (this.deferred.has(normalizedFilePath)) {
            // 触发取消信号：正在排队等待的任务会直接退出，正在识别的任务会中止循环并在检查点退出。
            this.abortControllers.get(normalizedFilePath)?.abort();
            // 目标是当前正在识别的任务时，再终止底层识别进程以缩短等待时间。
            if (this.activeFilePath === normalizedFilePath) {
                this.speechRecognitionGateway.cancelActive();
            }
            return true;
        }
        return false;
    }
}
