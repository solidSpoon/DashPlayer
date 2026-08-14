import path from 'path';

import { InsertVideoLearningClip, VideoLearningClip } from '@/backend/infrastructure/db/tables/videoLearningClip';
import { InsertVideoLearningClipWord } from '@/backend/infrastructure/db/tables/videoLearningClipWord';
import VideoLearningClipRepository from '@/backend/application/ports/repositories/VideoLearningClipRepository';
import VideoLearningClipWordRepository from '@/backend/application/ports/repositories/VideoLearningClipWordRepository';

import ErrorConstants from '@/common/constants/error-constants';
import TimeUtil from '@/common/utils/TimeUtil';
import StrUtil from '@/common/utils/str-util';
import SrtUtil, { SrtLine } from '@/common/utils/SrtUtil';

import { inject, injectable } from 'inversify';

import TYPES from '@/backend/ioc/types';
import { getMainLogger } from '@/backend/infrastructure/logger';

import { SimpleClipQuery } from '@/common/api/dto';
import { VideoLearningService } from '@/backend/application/services/VideoLearningService';
import CacheService from '@/backend/application/services/CacheService';
import { ClipOssService } from '@/backend/application/services/OssService';
import FfmpegService from '@/backend/application/services/FfmpegService';
import RendererGateway from '@/backend/application/ports/gateways/renderer/RendererGateway';
import SubtitleService from '@/backend/application/services/SubtitleService';

import { ClipMeta, ClipSrtLine, OssBaseMeta } from '@/common/types/clipMeta';
import { ClipVocabularyEntry, VideoLearningClipVO, VideoLearningClipPage } from '@/common/types/vo/VideoLearningClipVO';
import { GlobalVideoLearningClipQueueStatusVO, VideoLearningClipStatusVO } from '@/common/types/vo/VideoLearningClipStatusVO';
import { WordMatchService } from '@/backend/application/services/WordMatchService';
import { SrtSentence } from '@/common/types/SentenceC';
import { concurrency } from '@/backend/application/kernel/concurrency';
import StorageDirectoryProvider, {
    StorageDirectoryTarget,
} from '@/backend/application/ports/gateways/storage/StorageDirectoryProvider';
import FileSystemGateway from '@/backend/application/ports/gateways/storage/FileSystemGateway';
import VideoLearningClipAnalysis, { ClipCandidate } from '@/backend/application/services/impl/VideoLearningClipAnalysis';
import VideoLearningClipTaskQueue, {
    LearningClipTask,
    LearningClipTaskResult,
} from '@/backend/application/services/impl/VideoLearningClipTaskQueue';

/** 视频学习流程使用的字幕缓存。 */
type SrtCache = SrtSentence;

/**
 * 编排学习片段的分析、裁切、查询和同步。
 */
@injectable()
export default class VideoLearningServiceImpl implements VideoLearningService {
    private readonly logger = getMainLogger('VideoLearningServiceImpl');
    @inject(TYPES.VideoLearningOssService)
    private videoLearningOssService!: ClipOssService;

    @inject(TYPES.CacheService)
    private cacheService!: CacheService;

    @inject(TYPES.StorageDirectoryProvider)
    private storageDirectoryProvider!: StorageDirectoryProvider;

    @inject(TYPES.FileSystemGateway)
    private fileSystemGateway!: FileSystemGateway;

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
     * 按字幕管理的候选片段分析器。
     * 回调延迟读取属性注入的 WordMatchService。
     */
    private readonly clipAnalysis = new VideoLearningClipAnalysis(
        (texts) => this.wordMatchService.matchWordsInTexts(texts),
    );
    /**
     * 管理实际裁切任务的等待与串行消费。
     */
    private readonly clipTaskQueue = new VideoLearningClipTaskQueue({
        execute: (task) => this.addLearningClip(task),
        onTaskFinished: (result) => this.handleClipTaskFinished(result),
        onQueueError: (error) => {
            this.logger.error('视频学习片段队列消费异常', { error });
        },
    });
    /** 各字幕最近一次片段状态。 */
    private clipStatusCache: Map<string, VideoLearningClipStatusVO> = new Map();
    /** 各字幕状态通知的递增序号。 */
    private clipStatusSeq: Map<string, number> = new Map();

    /**
     * 从缓存读取字幕。
     *
     * @param srtKey 字幕缓存键。
     * @returns 缓存中的字幕；不存在时返回 null。
     */
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

        const candidates = await this.clipAnalysis.collectCandidates(srtKey, srt);

        if (candidates.length === 0) {
            await this.notifyClipStatus(videoPath, srtKey, 'completed', 0, 0, 0, 100);
            return;
        }

        const candidateKeys = candidates.map((candidate) => candidate.clipKey);
        const existingKeySet = await this.videoLearningClipRepository.findExistingKeys(candidateKeys);
        const queuedKeySet = new Set(
            this.clipTaskQueue.getTasksBySrt(srtKey).map((task) => task.clipKey),
        );

        let completedCount = 0;
        const tasks: LearningClipTask[] = [];

        for (const candidate of candidates) {
            if (existingKeySet.has(candidate.clipKey)) {
                completedCount++;
                continue;
            }

            if (queuedKeySet.has(candidate.clipKey)) {
                continue;
            }

            tasks.push({
                videoPath,
                srtKey,
                indexInSrt: candidate.indexInSrt,
                matchedWords: candidate.matchedWords,
                clipKey: candidate.clipKey,
                srtPath: resolvedSrtPath,
            });
        }

        this.clipTaskQueue.enqueue(tasks);
        const inProgressCount = this.clipTaskQueue.getTasksBySrt(srtKey).length;

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
        this.clipTaskQueue.start();
    }

    /**
     * 返回全局自动裁切队列的实时状态。
     *
     * @returns 全局自动裁切队列快照。
     */
    public async getGlobalClipQueueStatus(): Promise<GlobalVideoLearningClipQueueStatusVO> {
        const queuedCount = this.clipTaskQueue.getTaskCount();
        return {
            queuedCount,
            hasQueuedTasks: queuedCount > 0,
        };
    }

    /**
     * 清空尚未开始处理的自动裁切队列。
     *
     * 已经开始的 ffmpeg 任务会继续执行。
     *
     * @returns 被移除的排队任务数量。
     */
    public async cancelAllAutoClipTasks(): Promise<number> {
        const cancelled = this.clipTaskQueue.cancelPendingTasks();
        if (cancelled.count === 0) {
            return 0;
        }

        for (const srtKey of cancelled.srtKeys) {
            this.clipStatusCache.delete(srtKey);
        }

        return cancelled.count;
    }

    /**
     * 读取字幕缓存，必要时通过字幕服务重新加载。
     *
     * @param srtKey 字幕缓存键。
     * @param srtPath 缓存缺失时可用于重新解析的字幕路径。
     * @returns 已加载的字幕；路径缺失或解析失败时返回 null。
     */
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
     * 在单个任务结束后更新对应字幕的裁切状态。
     *
     * @param result 刚结束的任务及其执行结果。
     */
    private async handleClipTaskFinished(result: LearningClipTaskResult): Promise<void> {
        const { task, error } = result;
        if (error !== undefined) {
            this.logger.error('视频学习片段任务失败，已跳过', {
                clipKey: task.clipKey,
                srtKey: task.srtKey,
                videoPath: task.videoPath,
                error,
            });
            this.notifyClipTaskFailed(error);
        }

        const candidates = this.clipAnalysis.getCachedCandidates(task.srtKey);
        if (!candidates) {
            this.clipStatusCache.delete(task.srtKey);
            return;
        }
        await this.computeStatusFromCandidates(task.videoPath, task.srtKey, candidates);
    }

    /**
     * 通知渲染进程当前裁切任务失败。
     *
     * @param error 失败原因。
     */
    private notifyClipTaskFailed(error: unknown): void {
        const reason = error instanceof Error ? error.message?.trim() : '';
        const message = reason
            ? `裁切任务失败，已跳过：${reason.length > 200 ? `${reason.slice(0, 200)}…` : reason}`
            : '裁切任务失败，已跳过';
        this.rendererGateway.fireAndForget('ui/show-toast', {
            message,
            variant: 'error',
            duration: 5000,
        });
    }

    /**
     * 裁切视频片段并写入对象存储和本地索引。
     *
     * @param task 待新增的片段任务。
     */
    private async addLearningClip(task: LearningClipTask): Promise<void> {
        if (await this.clipInDb(task.clipKey)) {
            return;
        }

        const srt = await this.ensureSrtCached(task.srtKey, task.srtPath);
        if (!srt) {
            throw new Error(ErrorConstants.CACHE_NOT_FOUND);
        }

        const metaData = this.mapToMetaData(task.videoPath, srt, task.indexInSrt);
        const key = task.clipKey;

        const folder = await this.storageDirectoryProvider.provideDirectory(StorageDirectoryTarget.TEMP);
        const tempName = path.join(folder, key + '.mp4');

        try {
            const [trimStart, trimEnd] = this.mapTrimRange(srt, task.indexInSrt);
            await this.ffmpegService.trimVideo(task.videoPath, trimStart, trimEnd, tempName);

            await this.videoLearningOssService.putClip(key, tempName, metaData);
            const meta = await this.videoLearningOssService.get(key);
            if (!meta) {
                throw new Error('上传学习片段后未找到片段元数据');
            }
            await this.addToDb(meta);
        } finally {
            await this.fileSystemGateway.removeFileIfExists(tempName);
        }
    }

    /**
     * 计算目标字幕行及其上下文的裁切时间范围。
     *
     * @param srt 字幕内容。
     * @param indexInSrt 目标字幕行序号。
     * @returns 裁切开始和结束时间。
     */
    private mapTrimRange(srt: SrtCache, indexInSrt: number): [number, number] {
        const srtLines: SrtLine[] = srt.sentences.map((sentence) => SrtUtil.fromSentence(sentence));
        const clipContext = SrtUtil.getAround(srtLines, indexInSrt, 5);
        const startTime = clipContext[0].start ?? 0;
        const endTime = clipContext[clipContext.length - 1].end ?? 0;
        return [startTime, endTime];
    }

    /**
     * 生成片段上传所需的字幕和视频元数据。
     *
     * 字幕时间转换为相对片段起点的时间。
     *
     * @param videoPath 源视频绝对路径。
     * @param srt 字幕内容。
     * @param indexInSrt 目标字幕行序号。
     * @returns 片段元数据。
     */
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
            tags: [],
            video_name: videoPath,
            created_at: Date.now(),
            clip_content: clipJson
        };
    }

    /**
     * 删除片段的本地索引和远端文件。
     *
     * @param key 片段键。
     */
    public async deleteLearningClip(key: string): Promise<void> {
        await this.videoLearningClipRepository.deleteByKey(key);
        await this.videoLearningOssService.delete(key);
    }

    /**
     * 将片段元数据转换为前端视图对象。
     *
     * 本地排队任务使用原视频和绝对字幕时间，远端片段使用片段文件和相对时间。
     *
     * @param clip 本地任务或远端片段元数据。
     * @param vocabularyEntries 片段关联的词汇。
     * @returns 视频学习片段视图对象。
     */
    private convertToVideoLearningClipVO(
        clip: OssBaseMeta & ClipMeta & { sourceType: 'oss' | 'local' },
        vocabularyEntries: ClipVocabularyEntry[]
    ): VideoLearningClipVO {
        const videoPath = clip.sourceType === 'local' ? clip.video_name :
                        (clip.baseDir && clip.clip_file ? `${clip.baseDir}/${clip.clip_file}` : clip.video_name);

        const clipBeginAt = clip.sourceType === 'local'
            ? (clip as (typeof clip & { clipBeginAt?: number })).clipBeginAt ?? 0
            : 0;

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

    /**
     * 规范化词汇及其命中词形。
     *
     * @param entries 原始词汇条目。
     * @returns 去除空值并统一为小写的词汇条目。
     */
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

    /**
     * 将任务中的命中单词转换为基础词汇条目。
     *
     * @param baseWords 任务命中的单词。
     * @returns 去重并统一为小写的词汇条目。
     */
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

    /**
     * 批量读取片段关联的单词。
     *
     * @param keys 片段键列表。
     * @returns 以片段键索引的单词列表。
     */
    private async getClipWordsMap(keys: string[]): Promise<Map<string, string[]>> {
        return await this.videoLearningClipWordRepository.getWordsMapByClipKeys(keys);
    }

    /**
     * 分页查询已完成和正在裁切的学习片段。
     *
     * 正在裁切的任务排在已完成片段之前，并与数据库结果共用分页区间。
     *
     * @param query 查询词和分页参数。
     * @returns 学习片段分页结果。
     */
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

        const inProgressTasks = this.clipTaskQueue.getTasks()
            .filter((task) => {
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
                    const [clipBeginAt] = this.mapTrimRange(srt, task.indexInSrt);

                    const clipEntry = {
                        ...metaData,
                        key: task.clipKey,
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
                    this.logger.error('failed to process in-progress task', { error });
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

    /**
     * 将远端片段元数据及其命中单词写入本地数据库。
     *
     * @param metaData 远端片段元数据。
     */
    private async addToDb(metaData: ClipMeta & OssBaseMeta) {
        const srtLines = metaData.clip_content ?? [];
        const srtContext = srtLines.filter(e => !e.isClip).map(e => e.contentEn).join('\n');
        const srtClip = srtLines.filter(e => e.isClip).map(e => e.contentEn).join('\n');

        const clip: InsertVideoLearningClip = {
            key: metaData.key,
            video_name: metaData.video_name,
            srt_clip: srtClip,
            srt_context: srtContext,
            created_at: TimeUtil.timeUtc(),
            updated_at: TimeUtil.timeUtc()
        };

        // 使用目标字幕重新计算片段关联词。
        const wordRelations: InsertVideoLearningClipWord[] = [];
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
                wordRelations.push(...uniqueWords.map(word => ({
                    clip_key: metaData.key,
                    word,
                    created_at: TimeUtil.timeUtc(),
                    updated_at: TimeUtil.timeUtc()
                })));
            }
        }
        await this.videoLearningClipRepository.saveClipWithWords(clip, wordRelations);
    }

    /**
     * 检查片段是否已写入本地数据库。
     *
     * @param key 片段键。
     * @returns 片段存在时返回 true。
     */
    private async clipInDb(key: string) {
        return await this.videoLearningClipRepository.exists(key);
    }

    /**
     * 使用 OSS 中的片段完整重建本地索引。
     *
     * 同步与裁切任务共用互斥锁，避免重建索引时并发写入。
     */
    public async syncFromOss() {
        await concurrency.withMutex('video-learning-sync', async () => {
            const keys = await this.videoLearningOssService.list();
            const clips: InsertVideoLearningClip[] = [];
            const wordRelations: InsertVideoLearningClipWord[] = [];
            for (const key of keys) {
                const clip = await this.videoLearningOssService.get(key);
                if (!clip) {
                    continue;
                }
                const srtLines = clip.clip_content ?? [];
                const srtContext = srtLines.filter(e => !e.isClip).map(e => e.contentEn).join('\n');
                const srtClip = srtLines.filter(e => e.isClip).map(e => e.contentEn).join('\n');
                clips.push({
                    key: clip.key,
                    video_name: clip.video_name,
                    srt_clip: srtClip,
                    srt_context: srtContext,
                    created_at: TimeUtil.timeUtc(),
                    updated_at: TimeUtil.timeUtc(),
                });

                if (StrUtil.isNotBlank(srtClip)) {
                    const matches = await this.wordMatchService.matchWordsInText(srtClip);
                    const uniqueWords = Array.from(
                        new Set(
                            matches
                                .map(m => (m.databaseWord?.word || m.normalized || m.original || '').toLowerCase())
                                .filter(Boolean)
                        )
                    );
                    for (const word of uniqueWords) {
                        wordRelations.push({
                            clip_key: clip.key,
                            word,
                            created_at: TimeUtil.timeUtc(),
                            updated_at: TimeUtil.timeUtc(),
                        });
                    }
                }
            }
            await this.videoLearningClipRepository.replaceAll(clips, wordRelations);
        });
    }

    /**
     * 统计每个单词关联的学习片段数量。
     *
     * @returns 以单词索引的片段数量。
     */
    public async countClipsGroupedByWord(): Promise<Record<string, number>> {
        return await this.videoLearningClipWordRepository.countGroupedByWord();
    }

    /**
     * 清除字幕分析与状态缓存。
     *
     * 已经发出的分析请求不会被强制中断，但其结果会被丢弃。
     */
    public invalidateClipAnalysisCache(): void {
        this.clipAnalysis.clear();
        this.clipStatusCache.clear();
    }

    /**
     * 检测并返回指定字幕的学习片段状态。
     *
     * 优先使用已缓存的状态和候选片段；没有分析结果时在后台启动分析。
     *
     * @param videoPath 视频路径，用于状态通知。
     * @param srtKey 字幕缓存键。
     * @param srtPath 可选字幕路径，用于缓存缺失时补充加载。
     * @returns 当前片段状态快照。
     */
    public async detectClipStatus(videoPath: string, srtKey: string, srtPath?: string): Promise<VideoLearningClipStatusVO> {
        const srt = await this.ensureSrtCached(srtKey, srtPath);
        if (!srt) {
            throw new Error(ErrorConstants.CACHE_NOT_FOUND);
        }

        const cachedStatus = this.clipStatusCache.get(srtKey);
        if (cachedStatus && cachedStatus.status !== 'analyzing') {
            return this.ensureSeq(srtKey, cachedStatus);
        }

        const cachedCandidates = this.clipAnalysis.getCachedCandidates(srtKey);
        if (cachedCandidates) {
            return await this.computeStatusFromCandidates(videoPath, srtKey, cachedCandidates);
        }

        const progress = this.clipAnalysis.getProgress(srtKey)
            ?? this.clipAnalysis.getCachedProgress(srtKey)
            ?? 0;
        if (!this.clipAnalysis.isRunning(srtKey)) {
            this.startClipAnalysis(videoPath, srtKey, srt);
        }
        await this.notifyClipStatus(videoPath, srtKey, 'analyzing', undefined, undefined, undefined, progress);
        return this.ensureSeq(srtKey, { status: 'analyzing', analyzingProgress: progress });
    }

    /**
     * 为没有序列号的状态补充当前序号。
     *
     * @param srtKey 字幕缓存键。
     * @param status 当前状态。
     * @returns 带有序列号的状态。
     */
    private ensureSeq(srtKey: string, status: VideoLearningClipStatusVO): VideoLearningClipStatusVO {
        if (status.seq !== undefined) {
            return status;
        }
        const nextSeq = this.clipStatusSeq.get(srtKey) ?? 1;
        this.clipStatusSeq.set(srtKey, nextSeq);
        return { ...status, seq: nextSeq };
    }

    /**
     * 在后台启动字幕候选片段分析。
     *
     * 同一字幕已有分析任务时不会重复启动。
     *
     * @param videoPath 视频路径，用于通知渲染进程。
     * @param srtKey 字幕缓存键。
     * @param srt 已加载的字幕内容。
     */
    private startClipAnalysis(videoPath: string, srtKey: string, srt: SrtCache): void {
        if (this.clipAnalysis.isRunning(srtKey)) {
            return;
        }

        void this.clipAnalysis.collectCandidates(
            srtKey,
            srt,
            async (progress) => {
                await this.notifyClipStatus(videoPath, srtKey, 'analyzing', undefined, undefined, undefined, progress);
            },
        )
            .then(async (candidates) => {
                if (candidates.length === 0) {
                    await this.notifyClipStatus(videoPath, srtKey, 'completed', 0, 0, 0, 100);
                    return;
                }
                await this.computeStatusFromCandidates(videoPath, srtKey, candidates);
            })
            .catch(async (error) => {
                if (
                    error instanceof Error
                    && (error.message === 'CLIP_ANALYSIS_INVALIDATED'
                        || error.message === 'CLIP_ANALYSIS_REPLACED')
                ) {
                    return;
                }
                this.logger.error('分析裁切状态失败', { srtKey, videoPath, error });
                this.rendererGateway.fireAndForget('ui/show-toast', {
                    message: '学习片段分析失败，请检查字幕和词库后重试',
                    variant: 'error',
                    duration: 5000,
                });
            });
    }

    /**
     * 根据候选片段、当前任务队列和数据库记录计算指定字幕的裁切状态。
     *
     * @param videoPath 源视频绝对路径。
     * @param srtKey 字幕缓存键。
     * @param candidates 已完成分析的候选片段。
     * @returns 最新裁切状态；任务失败但仍未入库的片段会重新显示为待处理。
     */
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

        const existingKeySet = await this.videoLearningClipRepository.findExistingKeys(candidateKeys);
        const queueSnapshot = this.clipTaskQueue.getTasksBySrt(srtKey);
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

        this.logger.debug('clip status computed', {
            srtKey,
            status,
            pendingCount,
            inProgressCount,
            completedCount,
            candidates: candidates.length,
        });

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

    /**
     * 缓存并通知字幕的最新裁切状态。
     *
     * 状态内容没有变化时只保留缓存，不重复通知渲染进程。
     *
     * @param videoPath 视频路径。
     * @param srtKey 字幕缓存键。
     * @param status 当前状态。
     * @param pendingCount 待裁切数量。
     * @param inProgressCount 正在裁切数量。
     * @param completedCount 已完成数量。
     * @param analyzingProgress 分析进度百分比。
     */
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
            this.logger.debug('clip status notify', {
                videoPath,
                srtKey,
                status,
                pendingCount: pendingCount ?? null,
                inProgressCount: inProgressCount ?? null,
                completedCount: completedCount ?? null,
                analyzingProgress: analyzingProgress ?? null,
            });

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
            this.logger.error('failed to notify clip status', { error });
        }
    }
}
