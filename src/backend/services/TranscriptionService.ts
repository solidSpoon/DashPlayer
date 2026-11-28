import { inject, injectable } from 'inversify';
import type RendererGateway from '@/backend/services/gateways/renderer/RendererGateway';
import TYPES from '@/backend/ioc/types';
import * as path from 'path';
import type FfmpegService from '@/backend/services/FfmpegService';
import { getMainLogger } from '@/backend/infrastructure/logger';
import objectHash from 'object-hash';
import { serializeSrt, type SrtLine } from '@/common/utils/subtitle';
import type SpeechRecognitionGateway from '@/backend/services/gateways/media/SpeechRecognitionGateway';
import { type SpeechRecognitionResult, type SpeechRecognitionToken } from '@/backend/services/gateways/media/SpeechRecognitionGateway';
import type StorageDirectoryProvider from '@/backend/services/gateways/storage/StorageDirectoryProvider';
import { StorageDirectoryTarget } from '@/backend/services/gateways/storage/StorageDirectoryProvider';
import type FileSystemGateway from '@/backend/services/gateways/storage/FileSystemGateway';
import EnglishSubtitleSegmenter from '@/backend/utils/subtitle/EnglishSubtitleSegmenter';
import { concurrency } from '@/backend/utils/concurrency';
import {
    TRANSCRIPTION_CHUNK_SECONDS,
    type TranscriptTask,
    type TranscriptTaskResult,
    TranscriptTaskState,
    type TranscriptChunkResult,
} from '@/common/contracts/transcript/transcript-task';
import type TranscriptionTaskRepository from '@/backend/services/repositories/TranscriptionTaskRepository';
import type SubtitleService from '@/backend/services/SubtitleService';
import type TranscriptionEngineSelector from '@/backend/services/TranscriptionEngineSelector';
import type { Sentence } from '@/common/types/SentenceC';
import { CancelByUserError } from '@/backend/utils/errors/errors';
import { pcmDurationSeconds } from '@/backend/infrastructure/media/ffmpeg/pcmWav';

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
     * 启动文件转录并串行执行，直到完成、取消或失败。
     *
     * @param filePath 音视频文件绝对路径。
     * @param currentPosition 可选的当前播放位置（秒），用于优先识别附近分片。
     */
    transcribe(filePath: string, currentPosition?: number): Promise<void>;

    /**
     * 更新播放位置需求，用于调整尚未开始的识别分片优先级。
     *
     * @param filePath 媒体绝对路径。
     * @param currentPosition 当前播放位置（秒）。
     */
    updateDemand(filePath: string, currentPosition: number): void;

    /**
     * 返回进行中转录会话的增量字幕快照，供播放器重新挂载时恢复。
     *
     * @param filePath 媒体绝对路径。
     * @returns 当前增量字幕快照；无活跃会话时返回 null。
     */
    getSessionSnapshot(filePath: string): { sessionId: string; sentences: Sentence[] } | null;

    /**
     * 取消排队中或正在执行中的转录任务。
     *
     * @param filePath 目标文件路径。
     * @returns 找到并触发取消时返回 true。
     */
    cancel(filePath: string): boolean;
}

/** 音频分段的时间区间（秒）。 */
interface ChunkRange {
    /** 分段起始时间（秒，已含向前重叠区）。 */
    start: number;
    /** 分段结束时间（秒）。 */
    end: number;
}

/** 排队或执行中的单条转录任务上下文，仅存活于当前主进程生命周期。 */
interface ActiveTranscriptionTask {
    /** 本次增量字幕会话标识，兼作前端翻译缓存隔离键。 */
    sessionId: string;
    /** 取消信号控制器。 */
    abortController: AbortController;
    /** 任务创建时间戳（毫秒），用于向前端展示累计耗时。 */
    startedAt: number;
    /** 播放器上报的最新播放位置（秒）。 */
    currentPosition: number;
    /** 已完成分段的增量字幕行，按分片序号索引。 */
    chunks: Map<number, TranscriptChunkResult>;
    /** 按全局稳定序号缓存的已构建句子，避免增量重建时重复解析。 */
    builtSentences: Map<number, Sentence>;
    /** 快照是否对前端可见；完成写入 SRT 后须先置为 false 再上报 DONE。 */
    snapshotVisible: boolean;
}

/** 单段识别最多尝试次数（首轮 + 重试 2 次）。 */
const MAX_CHUNK_ATTEMPTS = 3;

/** 分段识别失败后重试前的退避基数（毫秒）。 */
const CHUNK_RETRY_BACKOFF_MS = 500;

/** 相邻音频分段的语音重叠时长（秒），用于避免切分边界切到单词。 */
const CHUNK_OVERLAP_SECONDS = 1;

/**
 * 生成转录任务的日志检索键。
 *
 * @param filePath 归一化后的媒体绝对路径。
 * @returns `transcription:<filePath>` 形式的 job 值。
 */
function transcriptionJob(filePath: string): string {
    return `transcription:${filePath}`;
}

/**
 * 按真实音轨时长规划含重叠边界的识别分段区间。
 *
 * @param durationSeconds 音轨实际总时长（秒）。
 * @returns 按时间顺序排列的分段区间。
 */
function planChunkRanges(durationSeconds: number): ChunkRange[] {
    const ranges: ChunkRange[] = [];
    for (let start = 0; start < durationSeconds; start += TRANSCRIPTION_CHUNK_SECONDS) {
        // 非首段向前多留出重叠区，保证切分边界处的单词完整出现在相邻两段中。
        const overlapStart = Math.max(0, start - CHUNK_OVERLAP_SECONDS);
        ranges.push({
            start: overlapStart,
            end: Math.min(durationSeconds, start + TRANSCRIPTION_CHUNK_SECONDS),
        });
    }
    return ranges;
}

/**
 * 从待识别队列中挑选距离当前播放位置最近的分片序号并移除。
 *
 * 已经完整播过的分片距离设为极大值，沉到队列末尾补齐。
 *
 * @param pending 剩余待识别的分片序号列表（会就地移除选中项）。
 * @param ranges 全部分段区间。
 * @param currentPosition 当前播放位置（秒）。
 * @returns 本轮选中的分片序号。
 */
function pickNextChunkIndex(pending: number[], ranges: ChunkRange[], currentPosition: number): number {
    let bestPos = 0;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let i = 0; i < pending.length; i++) {
        const range = ranges[pending[i]];
        const distance = range.end <= currentPosition
            ? Number.MAX_SAFE_INTEGER
            : Math.abs(range.start - currentPosition);
        if (distance < bestDistance) {
            bestDistance = distance;
            bestPos = i;
        }
    }
    return pending.splice(bestPos, 1)[0];
}

/**
 * 可被取消信号立即打断的异步等待。
 *
 * @param ms 等待毫秒数。
 * @param signal 取消信号。
 */
function sleepWithAbort(ms: number, signal: AbortSignal): Promise<void> {
    if (signal.aborted) {
        return Promise.reject(new CancelByUserError('Transcription cancelled by user'));
    }
    return new Promise((resolve, reject) => {
        const onAbort = () => {
            clearTimeout(timer);
            reject(new CancelByUserError('Transcription cancelled by user'));
        };
        const timer = setTimeout(() => {
            signal.removeEventListener('abort', onAbort);
            resolve();
        }, ms);
        signal.addEventListener('abort', onAbort, { once: true });
    });
}

/**
 * 使用后端数据库维护转录列表，并通过并发内核串行执行本地识别任务。
 */
@injectable()
export class LocalTranscriptionServiceImpl implements TranscriptionService {
    /** 排队中或运行中的转录任务索引，按归一化路径键入。 */
    private readonly tasks = new Map<string, ActiveTranscriptionTask>();

    /** 当前正在持有识别互斥锁执行的文件路径。 */
    private activeFilePath: string | null = null;

    /** 当前正在识别的文件使用的网关；任务结束后置空，供取消时终止底层进程。 */
    private activeRecognitionGateway: SpeechRecognitionGateway | null = null;

    private readonly logger = getMainLogger('LocalTranscriptionService');

    private readonly subtitleSegmenter = new EnglishSubtitleSegmenter();

    constructor(
        @inject(TYPES.FfmpegService) private ffmpegService: FfmpegService,
        @inject(TYPES.RendererGateway) private rendererGateway: RendererGateway,
        @inject(TYPES.TranscriptionEngineSelector) private transcriptionEngineSelector: TranscriptionEngineSelector,
        @inject(TYPES.StorageDirectoryProvider) private storageDirectoryProvider: StorageDirectoryProvider,
        @inject(TYPES.FileSystemGateway) private fileSystemGateway: FileSystemGateway,
        @inject(TYPES.TranscriptionTaskRepository) private transcriptionTaskRepository: TranscriptionTaskRepository,
        @inject(TYPES.SubtitleService) private subtitleService: SubtitleService,
    ) {}

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
     * 持久化任务状态并向渲染进程广播，处理中附带累计耗时秒数。
     *
     * @param filePath 被转录的媒体路径。
     * @param status 任务状态。
     * @param progress 整体进度百分比。
     * @param result 可选的阶段、错误或字幕路径。
     */
    private async sendProgress(
        filePath: string,
        status: TranscriptTaskState,
        progress: number,
        result?: TranscriptTaskResult,
    ): Promise<void> {
        const finalResult: TranscriptTaskResult = { ...result };
        if (status === TranscriptTaskState.INIT) {
            finalResult.phase ??= 'preparing';
            finalResult.message ??= '预处理中';
        } else if (status === TranscriptTaskState.IN_PROGRESS) {
            const startedAt = this.tasks.get(filePath)?.startedAt;
            const elapsedSeconds = startedAt === undefined ? 0 : Math.floor((Date.now() - startedAt) / 1000);
            if (finalResult.phase === 'preparing') {
                finalResult.message = `预处理中（${elapsedSeconds}秒）`;
            } else if (finalResult.phase === 'finishing') {
                finalResult.message = `整理字幕中（${elapsedSeconds}秒）`;
            } else {
                finalResult.phase = 'generating';
                finalResult.message = `${progress}%（${elapsedSeconds}秒）`;
            }
        }

        await this.transcriptionTaskRepository.updateByFilePath(filePath, {
            status,
            result: finalResult,
        });
        this.rendererGateway.fireAndForget('transcript/batch-result', {
            updates: [{
                filePath,
                taskId: 0,
                status,
                result: finalResult,
            }],
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
        if (this.tasks.has(normalizedFilePath)) {
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
        return this.sendProgress(this.normalizeFilePath(filePath), status, 0, result);
    }

    /**
     * 将文件加入本地转录队列，同一时间只处理一个文件。
     *
     * @param filePath 待转录媒体的绝对路径。
     * @param currentPosition 当前播放位置（秒）。
     */
    public async transcribe(filePath: string, currentPosition = 0): Promise<void> {
        const normalizedFilePath = this.normalizeFilePath(filePath);
        if (this.tasks.has(normalizedFilePath)) {
            throw new Error('File already in queue or processing');
        }

        const controller = new AbortController();
        this.tasks.set(normalizedFilePath, {
            sessionId: objectHash(`${normalizedFilePath}:${Date.now()}`),
            abortController: controller,
            startedAt: Date.now(),
            currentPosition: Number.isFinite(currentPosition) ? Math.max(0, currentPosition) : 0,
            chunks: new Map(),
            builtSentences: new Map(),
            snapshotVisible: true,
        });

        try {
            // 先落库再等待互斥锁，确保排队任务立即呈现在所有前端入口。
            await this.sendProgress(normalizedFilePath, TranscriptTaskState.INIT, 0);
        } catch (error) {
            this.tasks.delete(normalizedFilePath);
            throw error;
        }

        let executionStartedAt: number | null = null;
        try {
            await concurrency.withMutex('transcription', async () => {
                if (controller.signal.aborted) {
                    throw new CancelByUserError('Transcription cancelled by user');
                }
                this.activeFilePath = normalizedFilePath;
                executionStartedAt = Date.now();
                await this.doTranscribe(normalizedFilePath, controller.signal);
            }, { signal: controller.signal });
        } catch (error) {
            const job = transcriptionJob(normalizedFilePath);
            const elapsedMs = executionStartedAt !== null ? Date.now() - executionStartedAt : 0;
            // 排队等待或执行期间被用户取消，统一持久化为 cancelled。
            if (controller.signal.aborted) {
                this.logger.info('transcription cancelled', { job, elapsedMs });
                await this.sendProgress(normalizedFilePath, TranscriptTaskState.CANCELLED, 0, {
                    message: '转录任务已取消',
                });
                throw new CancelByUserError('Transcription cancelled by user');
            }

            const message = error instanceof Error ? error.message : String(error);
            this.logger.error('transcription failed', { job, elapsedMs, error: message });
            await this.sendProgress(normalizedFilePath, TranscriptTaskState.FAILED, 0, { error: message });
            throw error;
        } finally {
            this.tasks.delete(normalizedFilePath);
        }
    }

    /**
     * 更新播放位置需求，用于调整尚未开始的识别块的优先级。
     *
     * @param filePath 媒体绝对路径，与启动任务时使用的路径一致。
     * @param currentPosition 当前播放位置（秒）；非有限数时忽略。
     */
    public updateDemand(filePath: string, currentPosition: number): void {
        const task = this.tasks.get(this.normalizeFilePath(filePath));
        if (task && Number.isFinite(currentPosition)) {
            task.currentPosition = Math.max(0, currentPosition);
        }
    }

    /**
     * 返回当前会话已完成的全部字幕句子，供页面重新进入时恢复。
     *
     * @param filePath 媒体绝对路径。
     * @returns 会话快照；会话不存在或已完成撤回时返回 null。
     */
    public getSessionSnapshot(filePath: string): { sessionId: string; sentences: Sentence[] } | null {
        const task = this.tasks.get(this.normalizeFilePath(filePath));
        if (!task || !task.snapshotVisible) {
            return null;
        }
        const allLines = Array.from(task.chunks.values())
            .sort((a, b) => a.chunkIndex - b.chunkIndex)
            .flatMap((chunk) => chunk.sentences);
        const { sentences } = this.subtitleService.buildSentencesFromLines(allLines, task.sessionId, {
            reuseSentences: task.builtSentences,
        });
        return { sessionId: task.sessionId, sentences };
    }

    /**
     * 执行单个文件的完整转录流程并负责临时目录清理。
     *
     * @param filePath 待转录媒体的绝对路径。
     * @param signal 取消信号；触发后任务应在最近的检查点退出。
     */
    private async doTranscribe(filePath: string, signal: AbortSignal): Promise<void> {
        let tempFolder: string | null = null;

        try {
            await this.storageDirectoryProvider.ensurePathAccessPermissionIfExists(filePath);
            if (signal.aborted) {
                throw new CancelByUserError('Transcription cancelled by user');
            }

            // 目录名包含时间戳，避免同一文件前后任务的临时产物相互覆盖。
            const folderName = objectHash(`${filePath}::${Date.now()}`);
            const tempRoot = await this.storageDirectoryProvider.provideDirectory(StorageDirectoryTarget.TEMP);
            tempFolder = path.join(tempRoot, 'parakeet', folderName);
            await this.fileSystemGateway.ensureDirectory(tempFolder);

            await this.transcribeLocally({ filePath, tempFolder, signal });
        } finally {
            try {
                if (tempFolder) {
                    await this.fileSystemGateway.removeDirectoryIfExists(tempFolder);
                }
            } catch (cleanupError) {
                this.logger.warn('Failed to cleanup temporary files', { cleanupError });
            }
            this.activeFilePath = null;
            this.activeRecognitionGateway = null;
        }
    }

    /**
     * 一次性抽取整轨 PCM 并在取消信号到达时立即终止 FFmpeg 子进程。
     *
     * @param filePath 输入媒体路径。
     * @param pcmPath 输出原始 PCM 文件路径。
     * @param job 日志检索键。
     * @param signal 取消信号。
     */
    private async extractPcmWithAbort(
        filePath: string,
        pcmPath: string,
        job: string,
        signal: AbortSignal,
    ): Promise<void> {
        let cancelFfmpeg: (() => void) | null = null;
        const onAbort = () => {
            cancelFfmpeg?.();
        };
        signal.addEventListener('abort', onAbort, { once: true });
        try {
            await this.ffmpegService.extractRecognitionPcm({
                inputFile: filePath,
                outputFile: pcmPath,
                job,
                registerCancel: (cancel) => {
                    cancelFfmpeg = cancel;
                    if (signal.aborted) {
                        cancel();
                    }
                },
            });
        } finally {
            signal.removeEventListener('abort', onAbort);
        }
    }

    /**
     * 缓存当前分片的增量字幕行并向前端推送最新增量结果。
     *
     * @param task 当前活跃任务上下文。
     * @param filePath 媒体绝对路径。
     * @param chunkIndex 分片序号。
     * @param range 分片时间区间。
     * @param lines 本分片切出的字幕行。
     */
    private publishIncrementalChunk(
        task: ActiveTranscriptionTask,
        filePath: string,
        chunkIndex: number,
        range: ChunkRange,
        lines: SrtLine[],
    ): void {
        // 增量阶段使用全局稳定序号，避免各块的局部字幕序号互相覆盖。
        const chunk: TranscriptChunkResult = {
            filePath,
            chunkIndex,
            start: range.start,
            end: range.end,
            sentences: lines.map((line) => ({ ...line, index: chunkIndex * 100000 + line.index })),
        };
        task.chunks.set(chunkIndex, chunk);
        const allLines = Array.from(task.chunks.values())
            .sort((a, b) => a.chunkIndex - b.chunkIndex)
            .flatMap((c) => c.sentences);
        const { sentences } = this.subtitleService.buildSentencesFromLines(allLines, task.sessionId, {
            reuseSentences: task.builtSentences,
        });
        for (const sentence of sentences) {
            task.builtSentences.set(sentence.index, sentence);
        }
        this.rendererGateway.fireAndForget('transcript/chunk-result', {
            filePath,
            sessionId: task.sessionId,
            sentences,
        });
    }

    /**
     * 执行本地语音识别并生成适合播放器展示的 SRT。
     *
     * 引擎在任务启动时按设置选定并全程固定，避免中途切换导致各块时间轴风格不一致；
     * 先整轨解码为单份 PCM 再按字节切片，彻底消除多次 seek 失败和音画时长差引发的空片错误。
     *
     * @param opts 转录所需的输入路径、临时目录与取消信号。
     */
    private async transcribeLocally(opts: { filePath: string; tempFolder: string; signal: AbortSignal }): Promise<void> {
        const { filePath, tempFolder, signal } = opts;
        const job = transcriptionJob(filePath);
        const startedAt = Date.now();
        const modelsRoot = await this.storageDirectoryProvider.provideDirectory(StorageDirectoryTarget.MODELS);
        const speechRecognitionGateway = this.transcriptionEngineSelector.select();
        this.activeRecognitionGateway = speechRecognitionGateway;

        await this.sendProgress(filePath, TranscriptTaskState.IN_PROGRESS, 0, { phase: 'preparing' });
        if (signal.aborted) {
            throw new CancelByUserError('Transcription cancelled by user');
        }

        const pcmPath = path.join(tempFolder, 'full.pcm');
        await this.extractPcmWithAbort(filePath, pcmPath, job, signal);
        if (signal.aborted) {
            throw new CancelByUserError('Transcription cancelled by user');
        }

        // 以解码后的真实 PCM 字节计算时长，避免容器头时长虚高导致尾片无音频数据。
        const pcmBytes = await this.fileSystemGateway.getFileSize(pcmPath);
        const audioDuration = pcmDurationSeconds(pcmBytes);
        if (!Number.isFinite(audioDuration) || audioDuration <= 0) {
            throw new Error('媒体文件没有可用音频内容');
        }

        const ranges = planChunkRanges(audioDuration);
        this.logger.info('transcription started', { job, durationSecond: audioDuration, chunkCount: ranges.length });

        const chunkWavPath = path.join(tempFolder, 'chunk.wav');
        const chunkTimelines: SpeechRecognitionToken[][] = Array.from({ length: ranges.length }, () => []);
        const pending = ranges.map((_, index) => index);
        const totalChunks = pending.length;
        let previousIndex: number | null = null;
        let previousPosition: number | null = null;

        for (let processed = 0; processed < totalChunks; processed++) {
            if (signal.aborted) {
                throw new CancelByUserError('Transcription cancelled by user');
            }

            const task = this.tasks.get(filePath);
            const position = task?.currentPosition ?? 0;
            const index = pickNextChunkIndex(pending, ranges, position);
            if (previousIndex !== null && position !== previousPosition && index !== previousIndex + 1) {
                this.logger.info('chunk selection diverted by playback demand', {
                    job,
                    previousChunkIndex: previousIndex,
                    chunkIndex: index,
                    currentPosition: position,
                });
            }
            previousIndex = index;
            previousPosition = position;

            const progress = Math.min(99, Math.floor((processed / Math.max(totalChunks, 1)) * 100));
            await this.sendProgress(filePath, TranscriptTaskState.IN_PROGRESS, progress, {
                phase: 'generating',
                currentChunk: processed,
                totalChunks,
            });

            const range = ranges[index];
            const hasAudio = await this.ffmpegService.slicePcmToWav({
                pcmPath,
                outputWavPath: chunkWavPath,
                startSecond: range.start,
                endSecond: range.end,
            });
            if (!hasAudio) {
                continue;
            }

            const result = await this.transcribeChunkWithRetry({
                wavPath: chunkWavPath,
                modelsRoot,
                signal,
                filePath,
                progress,
                currentChunk: processed,
                totalChunks,
                job,
                gateway: speechRecognitionGateway,
            });
            // 无声或纯音乐片段返回空 token 列表，正常跳过并继续后续分片。
            if (result.tokens.length === 0) {
                this.logger.debug('silent or non-speech chunk skipped', { job, chunkIndex: index });
                continue;
            }

            const offset = range.start;
            const timeline = result.tokens.map((token) => ({
                ...token,
                start: token.start + offset,
                end: token.end === undefined ? undefined : token.end + offset,
            }));
            chunkTimelines[index] = timeline;

            // 增量展示同样按下一块切点排除重叠区，避免边界词在相邻两块的行里各出现一次。
            const nextCut = ranges[index + 1]?.start ?? Number.POSITIVE_INFINITY;
            const lines = this.subtitleSegmenter.segment([timeline], [range.start, nextCut]);
            if (lines.length > 0 && task) {
                this.publishIncrementalChunk(task, filePath, index, range, lines);
            }
        }

        if (signal.aborted) {
            throw new CancelByUserError('Transcription cancelled by user');
        }
        await this.sendProgress(filePath, TranscriptTaskState.IN_PROGRESS, 100, { phase: 'finishing' });

        const lines = this.subtitleSegmenter.segment(
            chunkTimelines,
            ranges.map((range) => range.start),
        );
        if (lines.length === 0) {
            throw new Error('未识别出可用字幕（视频可能没有语音内容）');
        }

        const finalSrt = serializeSrt(lines, { reindex: true });
        const srtFileName = filePath.replace(/\.[^/.]+$/, '') + '.srt';
        await this.storageDirectoryProvider.ensurePathAccessPermissionIfExists(srtFileName);
        await this.fileSystemGateway.writeTextFile(srtFileName, finalSrt);

        // 先撤回会话快照再宣布完成：前端收到 DONE 后会按真实 SRT 重建上下文，
        // 若此时快照仍可见，rebuild 会再次走增量路径而非解析落盘字幕。
        const currentTask = this.tasks.get(filePath);
        if (currentTask) {
            currentTask.snapshotVisible = false;
        }
        await this.sendProgress(filePath, TranscriptTaskState.DONE, 100, { srtPath: srtFileName });
        this.logger.info('transcription done', {
            job,
            elapsedMs: Date.now() - startedAt,
            chunkCount: ranges.length,
            srtPath: srtFileName,
        });
    }

    /**
     * 识别单个音频分段；失败时按取消状态区分退避重试与直接退出。
     *
     * @param opts 音频分段、模型目录、取消信号与进度信息。
     * @returns 识别结果；重试耗尽后抛出最后一次错误。
     */
    private async transcribeChunkWithRetry(opts: {
        wavPath: string;
        modelsRoot: string;
        signal: AbortSignal;
        filePath: string;
        progress: number;
        currentChunk: number;
        totalChunks: number;
        job: string;
        gateway: SpeechRecognitionGateway;
    }): Promise<SpeechRecognitionResult> {
        const { wavPath, modelsRoot, signal, filePath, progress, currentChunk, totalChunks, job, gateway } = opts;
        for (let attempt = 1; attempt <= MAX_CHUNK_ATTEMPTS; attempt++) {
            if (signal.aborted) {
                throw new CancelByUserError('Transcription cancelled by user');
            }
            let chunkSettled = false;
            try {
                // whisper 信号量统一限制识别任务并发；未配置时跳过锁顺序校验。
                return await concurrency.withSemaphore('whisper', async () => {
                    return await gateway.transcribe({
                        audioPath: wavPath,
                        modelsRoot,
                        job,
                        isCancelled: () => signal.aborted,
                        onHeartbeat: () => {
                            if (chunkSettled || signal.aborted) {
                                return;
                            }
                            void this.sendProgress(filePath, TranscriptTaskState.IN_PROGRESS, progress, {
                                phase: 'generating',
                                currentChunk,
                                totalChunks,
                            });
                        },
                    });
                }, { skipOrderCheck: true });
            } catch (error) {
                if (signal.aborted || error instanceof CancelByUserError) {
                    throw new CancelByUserError('Transcription cancelled by user');
                }
                const message = error instanceof Error ? error.message : String(error);
                if (attempt >= MAX_CHUNK_ATTEMPTS) {
                    this.logger.error('Chunk transcription failed after retries', { job, wavPath, attempt, message });
                    throw error;
                }
                this.logger.warn('Chunk transcription failed, retrying', { job, wavPath, attempt, message });
                await sleepWithAbort(CHUNK_RETRY_BACKOFF_MS * attempt, signal);
            } finally {
                chunkSettled = true;
            }
        }
        throw new Error('Chunk transcription failed');
    }

    /**
     * 取消排队中或正在识别的文件；任务在最近的检查点退出。
     *
     * @param filePath 目标媒体路径。
     * @returns 找到并取消任务时返回 true。
     */
    public cancel(filePath: string): boolean {
        const normalizedFilePath = this.normalizeFilePath(filePath);
        const task = this.tasks.get(normalizedFilePath);
        if (!task) {
            return false;
        }
        task.abortController.abort();
        if (this.activeFilePath === normalizedFilePath) {
            this.activeRecognitionGateway?.cancelActive();
        }
        return true;
    }
}
