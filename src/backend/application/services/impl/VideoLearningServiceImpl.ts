import path from 'path';
import fs from 'fs';

import db from '@/backend/infrastructure/db';
import { VideoLearningClip } from '@/backend/infrastructure/db/tables/videoLearningClip';
import { InsertVideoLearningClipWord } from '@/backend/infrastructure/db/tables/videoLearningClipWord';
import VideoLearningClipRepository from '@/backend/application/ports/repositories/VideoLearningClipRepository';
import VideoLearningClipWordRepository from '@/backend/application/ports/repositories/VideoLearningClipWordRepository';

import ErrorConstants from '@/common/constants/error-constants';
import TimeUtil from '@/common/utils/TimeUtil';
import StrUtil from '@/common/utils/str-util';
import SrtUtil, { SrtLine } from '@/common/utils/SrtUtil';

import { and, desc, eq, gte, inArray, like, lte, sql } from 'drizzle-orm';
import { inject, injectable, postConstruct } from 'inversify';

import TYPES from '@/backend/ioc/types';
import { getMainLogger } from '@/backend/infrastructure/logger';

import { ClipQuery, SimpleClipQuery } from '@/common/api/dto';
import { VideoLearningService } from '@/backend/application/services/VideoLearningService';
import CacheService from '@/backend/application/services/CacheService';
import { ClipOssService } from '@/backend/application/services/OssService';
import FfmpegService from '@/backend/application/services/FfmpegService';
import RendererGateway from '@/backend/application/ports/gateways/renderer/RendererGateway';
import SubtitleService from '@/backend/application/services/SubtitleService';

import { ClipMeta, ClipSrtLine, OssBaseMeta } from '@/common/types/clipMeta';
import { ClipVocabularyEntry, VideoLearningClipVO, VideoLearningClipPage } from '@/common/types/vo/VideoLearningClipVO';
import { GlobalVideoLearningClipQueueStatusVO, VideoLearningClipStatusVO } from '@/common/types/vo/VideoLearningClipStatusVO';
import { WordMatchService, MatchedWord } from '@/backend/application/services/WordMatchService';
import { SrtSentence } from '@/common/types/SentenceC';
import { concurrency } from '@/backend/application/kernel/concurrency';
import StorageDirectoryProvider, {
    StorageDirectoryTarget,
} from '@/backend/application/ports/gateways/storage/StorageDirectoryProvider';

type SrtCache = SrtSentence;

type LearningClipTask = {
    videoPath: string;
    srtKey: string;
    indexInSrt: number;
    matchedWords: string[];
    clipKey: string;
    operation: 'add' | 'cancel';
    srtPath?: string;
};

type ClipCandidate = {
    indexInSrt: number;
    clipKey: string;
    matchedWords: string[];
};

@injectable()
export default class VideoLearningServiceImpl implements VideoLearningService {
    private readonly logger = getMainLogger('VideoLearningServiceImpl');
    @inject(TYPES.VideoLearningOssService)
    private videoLearningOssService!: ClipOssService;

    @inject(TYPES.CacheService)
    private cacheService!: CacheService;

    @inject(TYPES.StorageDirectoryProvider)
    private storageDirectoryProvider!: StorageDirectoryProvider;

    @inject(TYPES.FfmpegService)
    private ffmpegService!: FfmpegService;

    @inject(TYPES.RendererGateway)
    private rendererGateway!: RendererGateway;

    @inject(TYPES.WordMatchService)
    private wordMatchService!: WordMatchService;

    @inject(TYPES.SubtitleService)
    private subtitleService!: SubtitleService;

    @inject(TYPES.VideoLearningClipRepository)
    private videoLearningClipRepository!: VideoLearningClipRepository;

    @inject(TYPES.VideoLearningClipWordRepository)
    private videoLearningClipWordRepository!: VideoLearningClipWordRepository;

    /**
     * 任务队列主键：clipKey = srtKey + '__' + indexInSrt。
     * 说明：这里不再使用字幕上下文哈希，确保同一字幕行的任务键稳定且可逆定位。
     */
    private taskQueue: Map<string, LearningClipTask> = new Map();

    // todo 改用 cacheService 存储, 无需过期时间，我会在其他业务逻辑中主动清理
    private clipAnalysisCache: Map<string, ClipCandidate[]> = new Map();
    private clipAnalysisChunkCache: Map<
        string,
        { totalChunks: number; chunks: Map<number, MatchedWord[][]> }
    > = new Map();
    private clipAnalysisPromises: Map<string, Promise<ClipCandidate[]>> = new Map();
    private clipAnalysisProgress: Map<string, number> = new Map();
    private clipStatusCache: Map<string, VideoLearningClipStatusVO> = new Map();
    private clipStatusSeq: Map<string, number> = new Map();
    private currentAnalysisKey: string | null = null;
    private readonly maxClipTasksPerTick = 1;
    private readonly analysisScheduler = concurrency.scheduler('default');

    private getSrtFromCache(srtKey: string): SrtCache | null {
        return (this.cacheService.get('cache:srt', srtKey) as SrtCache) ?? null;
    }

    /**
     * 将当前视频的候选片段批量加入自动裁切队列。
     *
     * @param videoPath 视频路径。
     * @param srtKey 字幕缓存键。
     * @param srtPath 可选字幕路径，用于补充加载缓存。
     */
    public async autoClip(videoPath: string, srtKey: string, srtPath?: string): Promise<void> {
        const srt = await this.ensureSrtCached(srtKey, srtPath);
        if (!srt) {
            throw new Error(ErrorConstants.CACHE_NOT_FOUND);
        }

        const resolvedSrtPath = srt.filePath || srtPath || undefined;

        const candidates = await this.collectClipCandidates(videoPath, srtKey, { srtPath: resolvedSrtPath });

        if (candidates.length === 0) {
            await this.notifyClipStatus(videoPath, srtKey, 'completed', 0, 0, 0, 100);
            return;
        }

        const candidateKeys = candidates.map((candidate) => candidate.clipKey);
        const existingKeySet = await this.videoLearningClipRepository.findExistingKeys(candidateKeys);
        const queueSnapshot = Array.from(this.taskQueue.values()).filter(
            (task) => task.operation === 'add' && task.srtKey === srtKey,
        );
        const queuedKeySet = new Set(queueSnapshot.map((task) => task.clipKey));

        let completedCount = 0;

        for (const candidate of candidates) {
            if (existingKeySet.has(candidate.clipKey)) {
                completedCount++;
                continue;
            }

            if (queuedKeySet.has(candidate.clipKey)) {
                continue;
            }

            const existingTask = this.taskQueue.get(candidate.clipKey);
            if (existingTask && existingTask.operation === 'add') {
                continue;
            }

            this.taskQueue.set(candidate.clipKey, {
                videoPath,
                srtKey,
                indexInSrt: candidate.indexInSrt,
                matchedWords: candidate.matchedWords,
                clipKey: candidate.clipKey,
                operation: 'add',
                srtPath: resolvedSrtPath,
            });
        }

        const inProgressCount = Array.from(this.taskQueue.values()).filter(
            (task) => task.operation === 'add' && task.srtKey === srtKey,
        ).length;

        const status: 'in_progress' | 'completed' = inProgressCount > 0 ? 'in_progress' : 'completed';

        await this.notifyClipStatus(
            videoPath,
            srtKey,
            status,
            0,
            inProgressCount || undefined,
            completedCount || undefined,
            status === 'completed' ? 100 : undefined,
        );
    }

    /**
     * 返回全局自动裁切队列的实时状态。
     *
     * @returns 全局自动裁切队列快照。
     */
    public async getGlobalClipQueueStatus(): Promise<GlobalVideoLearningClipQueueStatusVO> {
        const queuedCount = this.getQueuedAutoClipTaskCount();
        return {
            queuedCount,
            hasQueuedTasks: queuedCount > 0,
        };
    }

    /**
     * 清空尚未开始处理的自动裁切队列。
     *
     * 说明：
     * - 这里只移除队列中的新增裁切任务。
     * - 已经进入 ffmpeg 的任务允许自然完成，不做强制中断。
     *
     * @returns 被移除的排队任务数量。
     */
    public async cancelAllAutoClipTasks(): Promise<number> {
        const queuedTasks = Array.from(this.taskQueue.values()).filter((task) => task.operation === 'add');
        if (queuedTasks.length === 0) {
            return 0;
        }

        const affectedSrtKeys = new Set<string>();
        for (const task of queuedTasks) {
            affectedSrtKeys.add(task.srtKey);
            this.taskQueue.delete(task.clipKey);
        }

        for (const srtKey of affectedSrtKeys) {
            this.clipStatusCache.delete(srtKey);
        }

        return queuedTasks.length;
    }
    /**
     * 统计全局自动裁切队列中的新增任务数量。
     *
     * @returns 当前队列中的新增任务数。
     */
    private getQueuedAutoClipTaskCount(): number {
        return Array.from(this.taskQueue.values()).filter((task) => task.operation === 'add').length;
    }

    private mapToClipKey(srtKey: string, indexInSrt: number): string {
        return `${srtKey}__${indexInSrt}`;
    }

    private mapAnalysisKey(srtKey: string): string {
        return srtKey;
    }

    private async ensureSrtCached(srtKey: string, srtPath?: string): Promise<SrtCache | null> {
        let srt = this.getSrtFromCache(srtKey);
        if (srt) {
            return srt;
        }

        if (!srtPath) {
            return null;
        }

        try {
            await this.subtitleService.parseSrt(srtPath);
        } catch (error) {
            this.logger.error('[VideoLearningServiceImpl] failed to parse srt for cache', {
                srtKey,
                srtPath,
                error
            });
            return null;
        }

        srt = this.getSrtFromCache(srtKey);
        return srt;
    }

    /**
     * 定时任务
     */
    private async checkQueue() {
        if (this.taskQueue.size === 0) {
            return;
        }

        const concurrencySnapshot = concurrency.snapshot();
        const ffprobeStatus = concurrencySnapshot.semaphore.ffprobe ?? { waiting: 0 };
        const ffmpegStatus = concurrencySnapshot.semaphore.ffmpeg ?? { waiting: 0 };
        if (ffprobeStatus.waiting > 0 || ffmpegStatus.waiting > 0) {
            return;
        }

        const snapshot = new Map(this.taskQueue); // 快照，避免遍历中被修改
        const keys = Array.from(snapshot.keys());

        if (keys.length === 0) return;

        const existingKeys = await this.videoLearningClipRepository.findExistingKeys(keys);
        const notExistingKeys = keys.filter((k) => !existingKeys.has(k));

        // 用于通知
        let processedSrtKey = '';
        let processedVideoPath = '';

        // 处理新增任务：仅针对数据库中不存在的键
        let taskProcessed = 0;
        for (const key of notExistingKeys) {
            if (taskProcessed >= this.maxClipTasksPerTick) {
                break;
            }
            const task = snapshot.get(key);
            if (!task) {
                this.logger.error('[checkQueue] task not found for key:', key);
                continue;
            }
            if (task.operation === 'add') {
                processedSrtKey = task.srtKey;
                processedVideoPath = task.videoPath;
                await this.taskAddOperation(task);
                taskProcessed++;
            }
            // 从真实队列中删除该任务（如果没有被新的任务覆盖）
            if (this.taskQueue.get(key) === task) {
                this.taskQueue.delete(key);
            }
        }

        // 处理取消任务：仅针对数据库中存在的键
        for (const key of existingKeys) {
            if (taskProcessed >= this.maxClipTasksPerTick) {
                break;
            }
            const task = snapshot.get(key);
            if (!task) continue;
            if (task.operation === 'cancel') {
                processedSrtKey = task.srtKey;
                // 若该 cancel 任务未传 videoPath，可从队列中同 srtKey 的其它任务尝试补齐
                if (!processedVideoPath) {
                    const anyTaskForSrt = Array.from(this.taskQueue.values()).find(t => t.srtKey === processedSrtKey && t.operation === 'add');
                    processedVideoPath = anyTaskForSrt?.videoPath || '';
                }
                await this.taskCancelOperation(task);
                taskProcessed++;
            }
            if (this.taskQueue.get(key) === task) {
                this.taskQueue.delete(key);
            }
        }

        // 通知状态变更（仅针对本次处理过的 srtKey）
        if (processedSrtKey) {
            const remainingAddForSrt = Array.from(this.taskQueue.values())
                .filter(t => t.operation === 'add' && t.srtKey === processedSrtKey).length;
            const finalVideoPath =
                processedVideoPath ||
                Array.from(this.taskQueue.values()).find(t => t.srtKey === processedSrtKey)?.videoPath ||
                '';

            if (finalVideoPath) {
                if (remainingAddForSrt === 0) {
                    await this.notifyClipStatus(finalVideoPath, processedSrtKey, 'completed', 0, 0, 1);
                } else {
                    await this.notifyClipStatus(finalVideoPath, processedSrtKey, 'in_progress', 0, remainingAddForSrt, 0);
                }
            }
        }
    }

    private async taskAddOperation(task: LearningClipTask): Promise<void> {
        const srt = await this.ensureSrtCached(task.srtKey, task.srtPath);
        if (!srt) return;

        const metaData = this.mapToMetaData(task.videoPath, srt, task.indexInSrt);
        const key = task.clipKey;

        const folder = await this.storageDirectoryProvider.provideDirectory(StorageDirectoryTarget.TEMP);
        const tempName = path.join(folder, key + '.mp4');

        if (await this.clipInDb(key)) {
            return;
        }

        const [trimStart, trimEnd] = this.mapTrimRange(srt, task.indexInSrt);
        await this.ffmpegService.trimVideo(task.videoPath, trimStart, trimEnd, tempName);

        await this.videoLearningOssService.putClip(key, tempName, metaData);
        const meta = await this.videoLearningOssService.get(key);
        if (!meta) {
            throw new Error('meta not found after putClip');
        }
        await this.addToDb(meta);

        try {
            fs.rmSync(tempName, { force: true });
        } catch (e) {
            this.logger.warn('[taskAddOperation] failed to remove temp file', { tempName, error: e });
        }
    }

    public async taskCancelOperation(task: LearningClipTask): Promise<void> {
        await this.deleteLearningClip(task.clipKey);
    }

    private mapTrimRange(srt: SrtCache, indexInSrt: number): [number, number] {
        const srtLines: SrtLine[] = srt.sentences.map((sentence) => SrtUtil.fromSentence(sentence));
        const clipContext = SrtUtil.getAround(srtLines, indexInSrt, 5);
        const startTime = clipContext[0].start ?? 0;
        const endTime = clipContext[clipContext.length - 1].end ?? 0;
        return [startTime, endTime];
    }

    private async collectClipCandidates(
        _videoPath: string,
        srtKey: string,
        options?: { onProgress?: (progress: number) => Promise<void> | void; srtPath?: string }
    ): Promise<ClipCandidate[]> {
        const analysisKey = this.mapAnalysisKey(srtKey);

        const cached = this.clipAnalysisCache.get(analysisKey);
        if (cached) {
            return cached;
        }

        const existingPromise = this.clipAnalysisPromises.get(analysisKey);
        if (existingPromise) {
            return existingPromise;
        }

        const compute = async (): Promise<ClipCandidate[]> => {
            const srt = await this.ensureSrtCached(srtKey, options?.srtPath);
            if (!srt) {
                throw new Error(ErrorConstants.CACHE_NOT_FOUND);
            }

            this.analysisScheduler.beginFrame();
            const srtLines: SrtLine[] = srt.sentences.map((sentence) => SrtUtil.fromSentence(sentence));
            const contents = srtLines.map((line) => (line?.contentEn || '').toLowerCase());

            if (contents.length === 0) {
                return [];
            }

            const CHUNK_SIZE = 50;
            const totalChunks = Math.ceil(contents.length / CHUNK_SIZE);
            const matchResults: MatchedWord[][] = new Array(contents.length);

            const chunkCache =
                this.clipAnalysisChunkCache.get(analysisKey) ??
                { totalChunks, chunks: new Map<number, MatchedWord[][]>() };
            if (chunkCache.totalChunks !== totalChunks) {
                chunkCache.totalChunks = totalChunks;
                chunkCache.chunks.clear();
            }
            this.clipAnalysisChunkCache.set(analysisKey, chunkCache);

            let completedChunks = 0;
            for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
                const cachedChunk = chunkCache.chunks.get(chunkIndex);
                if (cachedChunk) {
                    const start = chunkIndex * CHUNK_SIZE;
                    for (let j = 0; j < cachedChunk.length; j++) {
                        matchResults[start + j] = cachedChunk[j];
                    }
                    completedChunks++;
                }
            }

            if (options?.onProgress) {
                const progress = Math.min(90, Math.round((completedChunks / totalChunks) * 90));
                this.clipAnalysisProgress.set(analysisKey, progress);
                await options.onProgress(progress);
            }
            this.logger.debug(
                `chunk cache state ${JSON.stringify({ srtKey, totalChunks, completedChunks })}`
            );

            for (let chunkIndex = 0; chunkIndex < totalChunks; chunkIndex++) {
                if (this.currentAnalysisKey !== analysisKey) {
                    throw new Error('ANALYSIS_CANCELLED');
                }
                if (chunkCache.chunks.has(chunkIndex)) {
                    continue;
                }
                const start = chunkIndex * CHUNK_SIZE;
                const chunk = contents.slice(start, start + CHUNK_SIZE);
                const chunkResults = await this.wordMatchService.matchWordsInTexts(chunk);
                chunkCache.chunks.set(chunkIndex, chunkResults);
                for (let j = 0; j < chunkResults.length; j++) {
                    matchResults[start + j] = chunkResults[j];
                }

                completedChunks++;
                const progress = Math.min(90, Math.round((completedChunks / totalChunks) * 90));
                if (options?.onProgress) {
                    this.clipAnalysisProgress.set(analysisKey, progress);
                    await options.onProgress(progress);
                }

                await this.analysisScheduler.yieldIfNeeded();
            }

            const candidates: ClipCandidate[] = [];

            for (let i = 0; i < srtLines.length; i++) {
                if (this.currentAnalysisKey !== analysisKey) {
                    throw new Error('ANALYSIS_CANCELLED');
                }
                const matches = matchResults[i] || [];
                if (matches && matches.length > 0) {
                    const matchedWords = Array.from(
                        new Set(
                            matches
                                .map((m) => (m.databaseWord?.word || m.normalized || m.original || '').toLowerCase())
                                .filter(Boolean)
                        )
                    );

                    if (matchedWords.length > 0) {
                        const clipKey = this.mapToClipKey(srtKey, i);
                        candidates.push({
                            indexInSrt: i,
                            clipKey,
                            matchedWords,
                        });
                    }
                }

                // 第二阶段进度：90% - 99%
                if (options?.onProgress && i % 100 === 0) {
                    const collectionProgress = 90 + Math.round((i / srtLines.length) * 9);
                    if (collectionProgress !== (this.clipAnalysisProgress.get(analysisKey) ?? 0)) {
                        this.clipAnalysisProgress.set(analysisKey, collectionProgress);
                        await options.onProgress(collectionProgress);
                    }
                    await this.analysisScheduler.yieldIfNeeded();
                }
            }

            if (options?.onProgress) {
                this.clipAnalysisProgress.set(analysisKey, 100);
                await options.onProgress(100);
            }

            return candidates;
        };

        const scheduled = compute();
        this.clipAnalysisPromises.set(analysisKey, scheduled);

        try {
            const candidates = await scheduled;
            this.clipAnalysisCache.set(analysisKey, candidates);
            return candidates;
        } finally {
            this.clipAnalysisPromises.delete(analysisKey);
            this.clipAnalysisProgress.delete(analysisKey);
        }
    }

    private mapToMetaData(videoPath: string, srt: SrtCache, indexInSrt: number): ClipMeta {
        const srtLines: SrtLine[] = srt.sentences.map((sentence) => SrtUtil.fromSentence(sentence));
        const clipContext = SrtUtil.getAround(srtLines, indexInSrt, 5);
        const clipLine = SrtUtil.findByIndex(srtLines, indexInSrt) as SrtLine;

        const startTime = clipContext[0].start ?? 0;
        const clipJson: ClipSrtLine[] = clipContext.map((item, idx) => ({
            index: idx,
            start: (item.start ?? 0) - startTime,
            end: (item.end ?? 0) - startTime,
            contentEn: item.contentEn,
            contentZh: item.contentZh,
            isClip: (item.start === clipLine.start && item.end === clipLine.end)
        }));

        return {
            clip_file: '',
            thumbnail_file: '',
            tags: [], // 确保 tags 字段为空
            video_name: videoPath,
            created_at: Date.now(),
            clip_content: clipJson
        };
    }

    public async deleteLearningClip(key: string): Promise<void> {
        await this.videoLearningClipRepository.deleteByKey(key);
        await this.videoLearningOssService.delete(key);
    }

    /**
     * 转换为视频学习片段VO
     */
    private convertToVideoLearningClipVO(
        clip: OssBaseMeta & ClipMeta & { sourceType: 'oss' | 'local' },
        vocabularyEntries: ClipVocabularyEntry[]
    ): VideoLearningClipVO {
        // 正在处理中：返回原视频路径，字幕时间使用原视频的绝对时间
        // 已处理完成：返回OSS片段路径，字幕时间是相对片段的
        const videoPath = clip.sourceType === 'local' ? clip.video_name :
                        (clip.baseDir && clip.clip_file ? `${clip.baseDir}/${clip.clip_file}` : clip.video_name);

        const clipBeginAt = clip.sourceType === 'local'
            ? (clip as (typeof clip & { clipBeginAt?: number })).clipBeginAt ?? 0
            : 0;

        // 后端直接返回处理好的时间，前端不用计算（local: absolute，oss: relative）
        const processedClipContent = (clip.clip_content ?? []).map(item => ({
            index: item.index,
            start: clip.sourceType === 'local' ? (clipBeginAt + item.start) : item.start,
            end: clip.sourceType === 'local' ? (clipBeginAt + item.end) : item.end,
            contentEn: item.contentEn,
            contentZh: item.contentZh,
            isClip: item.isClip
        }));
        const normalizedVocabulary = this.normalizeVocabularyEntries(vocabularyEntries);

        return {
            key: clip.key,
            sourceType: clip.sourceType,
            videoName: clip.video_name,
            videoPath: videoPath,
            createdAt: clip.created_at,
            clipContent: processedClipContent,
            vocabulary: normalizedVocabulary
        };
    }

    private normalizeVocabularyEntries(entries: ClipVocabularyEntry[] | undefined | null): ClipVocabularyEntry[] {
        if (!entries || entries.length === 0) {
            return [];
        }

        return entries
            .map((entry) => {
                const word = typeof entry.word === 'string' ? entry.word.toLowerCase().trim() : '';
                if (!word) {
                    return null;
                }
                const matchedForms = new Set<string>();
                (entry.matchedForms || []).forEach((form) => {
                    const normalizedForm = typeof form === 'string' ? form.toLowerCase().trim() : '';
                    if (normalizedForm) {
                        matchedForms.add(normalizedForm);
                    }
                });
                if (!matchedForms.size) {
                    matchedForms.add(word);
                }
                return {
                    word,
                    matchedForms: Array.from(matchedForms)
                };
            })
            .filter((entry): entry is ClipVocabularyEntry => entry !== null);
    }

    /**
     * 基于片段字幕与基础词列表，生成播放器高亮所需的词形映射。
     *
     * @param lines 片段字幕行。
     * @param baseWords 片段关联的基础词。
     * @returns 词汇映射结果。
     */
    private async buildVocabularyEntriesFromLines(
        lines: ClipSrtLine[] | undefined | null,
        baseWords: string[]
    ): Promise<ClipVocabularyEntry[]> {
        if (!lines || lines.length === 0) {
            return [];
        }

        const normalizedBaseWords = Array.from(
            new Set(
                baseWords
                    .map((word) => (typeof word === 'string' ? word.toLowerCase().trim() : ''))
                    .filter((word): word is string => !!word)
            )
        );

        if (normalizedBaseWords.length === 0) {
            return [];
        }

        const baseSet = new Set(normalizedBaseWords);
        const englishLines = lines
            .map((line) => line.contentEn || '')
            .filter((line) => typeof line === 'string' && line.trim().length > 0);

        if (englishLines.length === 0) {
            return normalizedBaseWords.map((word) => ({
                word,
                matchedForms: [word]
            }));
        }

        const matchResults = await this.wordMatchService.matchWordsInTexts(englishLines);
        const entryMap = new Map<string, Set<string>>();

        matchResults.forEach((matches) => {
            matches.forEach((match) => {
                const word = (match.databaseWord?.word || match.normalized || '').toLowerCase().trim();
                if (!word || !baseSet.has(word)) {
                    return;
                }
                const matchedForm = (match.original || match.normalized || '').toLowerCase().trim();
                if (!entryMap.has(word)) {
                    entryMap.set(word, new Set<string>());
                }
                if (matchedForm) {
                    entryMap.get(word)!.add(matchedForm);
                }
            });
        });

        baseSet.forEach((word) => {
            if (!entryMap.has(word)) {
                entryMap.set(word, new Set([word]));
            }
        });

        return Array.from(entryMap.entries()).map(([word, matchedForms]) => ({
            word,
            matchedForms: Array.from(matchedForms)
        }));
    }

    /**
     * 为单个片段生成词汇高亮映射。
     *
     * @param lines 片段字幕行。
     * @param words 片段关联的基础词。
     * @returns 词汇映射结果。
     */
    public async resolveClipVocabulary(lines: ClipSrtLine[], words: string[]): Promise<ClipVocabularyEntry[]> {
        return await this.buildVocabularyEntriesFromLines(lines, words);
    }

    private buildVocabularyEntriesFromMatchedWords(baseWords: string[] | undefined | null): ClipVocabularyEntry[] {
        if (!baseWords || baseWords.length === 0) {
            return [];
        }

        const normalizedBaseWords = Array.from(
            new Set(
                baseWords
                    .map((word) => (typeof word === 'string' ? word.toLowerCase().trim() : ''))
                    .filter((word): word is string => !!word)
            )
        );

        return normalizedBaseWords.map((word) => ({
            word,
            matchedForms: [word],
        }));
    }

    private async getClipWordsMap(keys: string[]): Promise<Map<string, string[]>> {
        return await this.videoLearningClipWordRepository.getWordsMapByClipKeys(keys);
    }

    public async search({ word, page, pageSize }: SimpleClipQuery): Promise<VideoLearningClipPage> {
        const normalizedPageSize = Math.min(Math.max(pageSize ?? 12, 1), 100);
        const normalizedPage = Math.max(page ?? 1, 1);
        const offset = (normalizedPage - 1) * normalizedPageSize;
        const searchWord = StrUtil.isNotBlank(word) ? word.trim().toLowerCase() : '';

        let dbClipKeys: string[] | undefined;

        if (StrUtil.isNotBlank(searchWord)) {
            dbClipKeys = await this.videoLearningClipWordRepository.findClipKeysByWord(searchWord);
        }
        const dbTotal = await this.videoLearningClipRepository.count({ keys: dbClipKeys });

        const inProgressTasks = Array.from(this.taskQueue.values())
            .filter(task => task.operation === 'add')
            .filter(task => {
                if (!searchWord) {
                    return true;
                }
                return task.matchedWords.some(matched => matched.toLowerCase() === searchWord);
            });

        const start = offset;
        const end = offset + normalizedPageSize;

        const inProgressCount = inProgressTasks.length;

        const paginatedInProgress: VideoLearningClipVO[] = [];
        if (start < inProgressCount) {
            const inProgressEnd = Math.min(end, inProgressCount);
            const pageTasks = inProgressTasks.slice(start, inProgressEnd);

            for (const task of pageTasks) {
                try {
                    const srt = await this.ensureSrtCached(task.srtKey, task.srtPath);
                    if (!srt) {
                        continue;
                    }

                    const metaData = this.mapToMetaData(task.videoPath, srt, task.indexInSrt);
                    const key = this.mapToClipKey(task.srtKey, task.indexInSrt);
                    const [clipBeginAt] = this.mapTrimRange(srt, task.indexInSrt);

                    const clipEntry = {
                        ...metaData,
                        key,
                        sourceType: 'local' as const,
                        version: 1,
                        clip_file: task.videoPath,
                        thumbnail_file: '',
                        baseDir: '',
                        clipBeginAt
                    } as unknown as OssBaseMeta & ClipMeta & { sourceType: 'local' };

                    const vocabulary = this.buildVocabularyEntriesFromMatchedWords(task.matchedWords);
                    paginatedInProgress.push(this.convertToVideoLearningClipVO(clipEntry, vocabulary));
                } catch (error) {
                    this.logger.error('Failed to process in-progress task:', error);
                }
            }
        }

        const dbOffset = Math.max(0, start - inProgressCount);
        const dbLimit = Math.max(0, end - Math.max(start, inProgressCount));

        let completedVOs: VideoLearningClipVO[] = [];
        if (dbLimit > 0) {
            const lines: VideoLearningClip[] = await this.videoLearningClipRepository.listPage({
                keys: dbClipKeys,
                offset: dbOffset,
                limit: dbLimit,
            });

            if (lines.length > 0) {
                const ossMetas = await Promise.all(
                    lines.map((line) => this.videoLearningOssService.get(line.key))
                );
                const completedClips = ossMetas.filter((m): m is OssBaseMeta & ClipMeta => m !== null);
                const completedWithSourceType = completedClips.map(clip => ({
                    ...clip,
                    sourceType: 'oss' as const
                }));
                const wordMap = await this.getClipWordsMap(completedWithSourceType.map(clip => clip.key));
                completedVOs = await Promise.all(
                    completedWithSourceType.map(async (clip) => {
                        const vocabulary = this.buildVocabularyEntriesFromMatchedWords(wordMap.get(clip.key) ?? []);
                        return this.convertToVideoLearningClipVO(clip, vocabulary);
                    })
                );
            }
        }

        return {
            items: [...paginatedInProgress, ...completedVOs],
            total: inProgressCount + dbTotal,
            page: normalizedPage,
            pageSize: normalizedPageSize
        };
    }

    private async addToDb(metaData: ClipMeta & OssBaseMeta) {
        const srtLines = metaData.clip_content ?? [];
        const srtContext = srtLines.filter(e => !e.isClip).map(e => e.contentEn).join('\n');
        const srtClip = srtLines.filter(e => e.isClip).map(e => e.contentEn).join('\n');

        await this.videoLearningClipRepository.upsert({
            key: metaData.key,
            video_name: metaData.video_name,
            srt_clip: srtClip,
            srt_context: srtContext,
            created_at: TimeUtil.timeUtc(),
            updated_at: TimeUtil.timeUtc()
        });

        // 始终通过算法对核心文本进行匹配，以写入单词关系
        if (StrUtil.isNotBlank(srtClip)) {
            const matches = await this.wordMatchService.matchWordsInText(srtClip);
            const uniqueWords = Array.from(
              new Set(
                matches
                  .map(m => (m.databaseWord?.word || m.normalized || m.original || '').toLowerCase())
                  .filter(Boolean)
              )
            );

            if (uniqueWords.length > 0) {
                const wordRelations: InsertVideoLearningClipWord[] = uniqueWords.map(word => ({
                    clip_key: metaData.key,
                    word,
                    created_at: TimeUtil.timeUtc(),
                    updated_at: TimeUtil.timeUtc()
                }));
                await this.videoLearningClipWordRepository.insertManyIgnoreDuplicates(wordRelations);
            }
        }
    }

    private async clipInDb(key: string) {
        return await this.videoLearningClipRepository.exists(key);
    }

    /**
     * 清除数据库，重新从 OSS 同步
     */
    public async syncFromOss() {
        const keys = await this.videoLearningOssService.list();
        await this.videoLearningClipRepository.deleteAll();
        await this.videoLearningClipWordRepository.deleteAll();
        for (const key of keys) {
            const clip = await this.videoLearningOssService.get(key);
            if (!clip) continue;
            await this.addToDb(clip);
        }
    }

    public async countClipsGroupedByWord(): Promise<Record<string, number>> {
        return await this.videoLearningClipWordRepository.countGroupedByWord();
    }

    public invalidateClipAnalysisCache(): void {
        this.clipAnalysisCache.clear();
        this.clipAnalysisChunkCache.clear();
        this.clipAnalysisPromises.clear();
        this.clipAnalysisProgress.clear();
        this.clipStatusCache.clear();
        this.currentAnalysisKey = null;
    }

    @postConstruct()
    public postConstruct() {
        const loop = async () => {
            try {
                await this.checkQueue();
            } catch (e) {
                this.logger.error('[VideoLearningServiceImpl] checkQueue error:', e);
            } finally {
                setTimeout(loop, 1000);
            }
        };
        // fire-and-forget
        loop().catch((e) => this.logger.error('VideoLearningServiceImpl loop failed', { error: e }));
    }

    /**
     * 检测并返回指定字幕的学习片段状态。
     *
     * 行为说明：
     * - 优先命中缓存与进行中的分析任务，避免重复计算。
     * - 当字幕缓存缺失时，返回 completed 以避免前端长期等待。
     *
     * @param videoPath 视频路径，用于状态通知。
     * @param srtKey 字幕缓存键。
     * @param srtPath 可选字幕路径，用于缓存缺失时补充加载。
     * @returns 当前片段状态快照。
     */
    public async detectClipStatus(videoPath: string, srtKey: string, srtPath?: string): Promise<VideoLearningClipStatusVO> {
        const analysisKey = this.mapAnalysisKey(srtKey);
        this.logger.debug(
            `detect ${JSON.stringify({
                videoPath,
                srtKey,
                hasSrtPath: !!srtPath,
                currentAnalysisKey: this.currentAnalysisKey,
                cachedStatus: this.clipStatusCache.get(srtKey)?.status ?? null,
                cachedCandidates: this.clipAnalysisCache.has(analysisKey),
                chunkCache: this.clipAnalysisChunkCache.has(analysisKey),
                inFlight: this.clipAnalysisPromises.has(analysisKey),
                progress: this.clipAnalysisProgress.get(analysisKey) ?? null,
            })}`
        );
        const srt = await this.ensureSrtCached(srtKey, srtPath);
        if (!srt) {
            this.logger.debug(`srt cache miss ${JSON.stringify({ srtKey, videoPath })}`);
            await this.notifyClipStatus(videoPath, srtKey, 'completed', 0, 0, 0, 100);
            return { status: 'completed' };
        }

        const cachedStatus = this.clipStatusCache.get(srtKey);
        if (cachedStatus && cachedStatus.status !== 'analyzing') {
            this.logger.debug(
                `status cache hit ${JSON.stringify({
                    srtKey,
                    status: cachedStatus.status,
                    pendingCount: cachedStatus.pendingCount ?? null,
                    inProgressCount: cachedStatus.inProgressCount ?? null,
                    completedCount: cachedStatus.completedCount ?? null,
                })}`
            );
            return this.ensureSeq(srtKey, cachedStatus);
        }

        const cachedCandidates = this.clipAnalysisCache.get(analysisKey);
        if (cachedCandidates) {
            this.logger.debug(`candidates cache hit ${JSON.stringify({ srtKey, count: cachedCandidates.length })}`);
            return await this.computeStatusFromCandidates(videoPath, srtKey, cachedCandidates);
        }

        const chunkCache = this.clipAnalysisChunkCache.get(analysisKey);
        if (chunkCache && chunkCache.totalChunks > 0) {
            const completedChunks = chunkCache.chunks.size;
            const progress = Math.min(99, Math.round((completedChunks / chunkCache.totalChunks) * 100));
            if (progress > 0) {
                this.logger.debug(
                    `chunk progress hit ${JSON.stringify({
                        srtKey,
                        completedChunks,
                        totalChunks: chunkCache.totalChunks,
                        progress,
                    })}`
                );
                this.clipAnalysisProgress.set(analysisKey, progress);
                await this.notifyClipStatus(videoPath, srtKey, 'analyzing', undefined, undefined, undefined, progress);
                if (!this.clipAnalysisPromises.has(analysisKey)) {
                    const resolvedSrtPath = srt.filePath || srtPath || undefined;
                    this.startClipAnalysis(videoPath, srtKey, resolvedSrtPath);
                }
                return this.ensureSeq(srtKey, { status: 'analyzing', analyzingProgress: progress });
            }
        }

        if (this.clipAnalysisPromises.has(analysisKey)) {
            this.logger.debug(`analysis in progress ${JSON.stringify({ srtKey })}`);
            const progress = this.clipAnalysisProgress.get(analysisKey) ?? 0;
            await this.notifyClipStatus(videoPath, srtKey, 'analyzing', undefined, undefined, undefined, progress);
            return this.ensureSeq(srtKey, { status: 'analyzing', analyzingProgress: progress });
        }

        const progress = this.clipAnalysisProgress.get(analysisKey);
        if (typeof progress === 'number') {
            await this.notifyClipStatus(videoPath, srtKey, 'analyzing', undefined, undefined, undefined, progress);
            return this.ensureSeq(srtKey, { status: 'analyzing', analyzingProgress: progress });
        }

        const resolvedSrtPath = srt.filePath || srtPath || undefined;
        this.startClipAnalysis(videoPath, srtKey, resolvedSrtPath);
        this.logger.debug(`start analysis ${JSON.stringify({ srtKey, videoPath })}`);
        await this.notifyClipStatus(videoPath, srtKey, 'analyzing', undefined, undefined, undefined, 0);
        return this.ensureSeq(srtKey, { status: 'analyzing', analyzingProgress: 0 });
    }

    private ensureSeq(srtKey: string, status: VideoLearningClipStatusVO): VideoLearningClipStatusVO {
        if (status.seq !== undefined) {
            return status;
        }
        const nextSeq = this.clipStatusSeq.get(srtKey) ?? 1;
        this.clipStatusSeq.set(srtKey, nextSeq);
        return { ...status, seq: nextSeq };
    }

    private startClipAnalysis(videoPath: string, srtKey: string, srtPath?: string): void {
        const analysisKey = this.mapAnalysisKey(srtKey);
        this.currentAnalysisKey = analysisKey;
        if (this.clipAnalysisPromises.has(analysisKey)) {
            return;
        }

        this.logger.debug(
            `start ${JSON.stringify({ srtKey, videoPath, srtPath: srtPath ?? null })}`
        );
        void this.collectClipCandidates(videoPath, srtKey, {
            onProgress: async (progress) => {
                await this.notifyClipStatus(videoPath, srtKey, 'analyzing', undefined, undefined, undefined, progress);
            },
            srtPath,
            })
            .then(async (candidates) => {
                if (this.currentAnalysisKey !== analysisKey) {
                    this.logger.debug(`cancelled after compute ${JSON.stringify({ srtKey })}`);
                    return;
                }
                if (candidates.length === 0) {
                    this.logger.debug(`no candidates ${JSON.stringify({ srtKey })}`);
                    await this.notifyClipStatus(videoPath, srtKey, 'completed', 0, 0, 0, 100);
                    return;
                }
                this.logger.debug(`candidates ready ${JSON.stringify({ srtKey, count: candidates.length })}`);
                await this.computeStatusFromCandidates(videoPath, srtKey, candidates);
            })
            .catch(async (error) => {
                if (error instanceof Error && error.message === 'ANALYSIS_CANCELLED') {
                    this.logger.debug(`cancelled ${JSON.stringify({ srtKey })}`);
                    this.clipAnalysisProgress.delete(analysisKey);
                    return;
                }
                this.logger.error('分析裁切状态失败:', error);
                await this.notifyClipStatus(videoPath, srtKey, 'completed', 0, 0, 0, 100);
            });
    }

    private async computeStatusFromCandidates(
        videoPath: string,
        srtKey: string,
        candidates: ClipCandidate[]
    ): Promise<VideoLearningClipStatusVO> {
        if (candidates.length === 0) {
            await this.notifyClipStatus(videoPath, srtKey, 'completed', 0, 0, 0, 100);
            return { status: 'completed' };
        }

        const candidateKeys = candidates.map((candidate) => candidate.clipKey);

        const [existingKeySet, queueSnapshot] = await Promise.all([
            this.videoLearningClipRepository.findExistingKeys(candidateKeys),
            Promise.resolve(
                Array.from(this.taskQueue.values()).filter(
                    (task) => task.operation === 'add' && task.srtKey === srtKey,
                ),
            ),
        ]);
        const inQueueKeySet = new Set(queueSnapshot.map((task) => task.clipKey));

        let pendingCount = 0;
        let inProgressCount = 0;
        let completedCount = 0;

        for (const candidate of candidates) {
            if (inQueueKeySet.has(candidate.clipKey)) {
                inProgressCount++;
            } else if (existingKeySet.has(candidate.clipKey)) {
                completedCount++;
            } else {
                pendingCount++;
            }
        }

        let status: 'pending' | 'in_progress' | 'completed' = 'completed';
        if (inProgressCount > 0) {
            status = 'in_progress';
        } else if (pendingCount > 0) {
            status = 'pending';
        }

        this.logger.debug(
            `computed ${JSON.stringify({
                srtKey,
                status,
                pendingCount,
                inProgressCount,
                completedCount,
                candidates: candidates.length,
            })}`
        );

        await this.notifyClipStatus(
            videoPath,
            srtKey,
            status,
            pendingCount || undefined,
            inProgressCount || undefined,
            completedCount || undefined,
            status === 'completed' ? 100 : undefined,
        );

        return {
            status,
            pendingCount: pendingCount || undefined,
            inProgressCount: inProgressCount || undefined,
            completedCount: completedCount || undefined,
            seq: this.clipStatusSeq.get(srtKey),
        };
    }

    private async notifyClipStatus(
        videoPath: string,
        srtKey: string,
        status: 'pending' | 'in_progress' | 'completed' | 'analyzing',
        pendingCount?: number,
        inProgressCount?: number,
        completedCount?: number,
        analyzingProgress?: number
    ): Promise<void> {
        try {
            this.logger.debug(
                `notify ${JSON.stringify({
                    videoPath,
                    srtKey,
                    status,
                    pendingCount: pendingCount ?? null,
                    inProgressCount: inProgressCount ?? null,
                    completedCount: completedCount ?? null,
                    analyzingProgress: analyzingProgress ?? null,
                })}`
            );

            let message = '';
            if (status === 'pending') {
                message = `发现 ${pendingCount ?? 0} 个需要裁切的学习片段`;
            } else if (status === 'in_progress') {
                message = `正在裁切 ${inProgressCount ?? 0} 个学习片段`;
            } else if (status === 'analyzing') {
                message = `正在分析视频内容 (${analyzingProgress ?? 0}%)`;
            } else {
                message = '所有学习片段已裁切完成';
            }

            const cachePayload: VideoLearningClipStatusVO = {
                status,
            };

            if (typeof pendingCount === 'number') {
                cachePayload.pendingCount = pendingCount;
            }
            if (typeof inProgressCount === 'number') {
                cachePayload.inProgressCount = inProgressCount;
            }
            if (typeof completedCount === 'number') {
                cachePayload.completedCount = completedCount;
            }
            if (typeof analyzingProgress === 'number') {
                cachePayload.analyzingProgress = analyzingProgress;
            }

            const cacheKey = srtKey;
            const prev = this.clipStatusCache.get(cacheKey);
            const sameStatus =
                prev?.status === cachePayload.status &&
                prev?.pendingCount === cachePayload.pendingCount &&
                prev?.inProgressCount === cachePayload.inProgressCount &&
                prev?.completedCount === cachePayload.completedCount &&
                prev?.analyzingProgress === cachePayload.analyzingProgress;

            const nextSeq = sameStatus ? (prev?.seq ?? 0) : (this.clipStatusSeq.get(cacheKey) ?? prev?.seq ?? 0) + 1;
            this.clipStatusSeq.set(cacheKey, nextSeq);
            cachePayload.seq = nextSeq;
            this.clipStatusCache.set(cacheKey, cachePayload);

            if (!sameStatus) {
                await this.rendererGateway.call('video-learning/clip-status-update', {
                    videoPath,
                    srtKey,
                    status,
                    pendingCount,
                    inProgressCount,
                    completedCount,
                    message,
                    analyzingProgress,
                    seq: nextSeq
                });
            }
        } catch (error) {
            this.logger.error('Failed to notify clip status:', error);
        }
    }
}
