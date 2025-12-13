import hash from 'object-hash';
import path from 'path';
import fs from 'fs';

import db from '@/backend/db';
import { VideoLearningClip, videoLearningClip } from '@/backend/db/tables/videoLearningClip';
import { words } from '@/backend/db/tables/words';
import { videoLearningClipWord, InsertVideoLearningClipWord } from '@/backend/db/tables/videoLearningClipWord';

import ErrorConstants from '@/common/constants/error-constants';
import TimeUtil from '@/common/utils/TimeUtil';
import StrUtil from '@/common/utils/str-util';
import SrtUtil, { SrtLine } from '@/common/utils/SrtUtil';

import { and, desc, eq, gte, inArray, like, lte, sql } from 'drizzle-orm';
import { inject, injectable, postConstruct } from 'inversify';

import TYPES from '@/backend/ioc/types';
import dpLog from '@/backend/ioc/logger';

import { ClipQuery, SimpleClipQuery } from '@/common/api/dto';
import { VideoLearningService } from '@/backend/services/VideoLearningService';
import CacheService from '@/backend/services/CacheService';
import LocationService, { LocationType } from '@/backend/services/LocationService';
import { ClipOssService } from '@/backend/services/OssService';
import FfmpegService from '@/backend/services/FfmpegService';
import SystemService from '@/backend/services/SystemService';
import SubtitleService from '@/backend/services/SubtitleService';

import { ClipMeta, ClipSrtLine, OssBaseMeta } from '@/common/types/clipMeta';
import { ClipVocabularyEntry, VideoLearningClipVO, VideoLearningClipPage } from '@/common/types/vo/VideoLearningClipVO';
import { VideoLearningClipStatusVO } from '@/common/types/vo/VideoLearningClipStatusVO';
import { WordMatchService, MatchedWord } from '@/backend/services/WordMatchService';
import { SrtSentence } from '@/common/types/SentenceC';

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
    @inject(TYPES.VideoLearningOssService)
    private videoLearningOssService!: ClipOssService;

    @inject(TYPES.CacheService)
    private cacheService!: CacheService;

    @inject(TYPES.LocationService)
    private locationService!: LocationService;

    @inject(TYPES.FfmpegService)
    private ffmpegService!: FfmpegService;

    @inject(TYPES.SystemService)
    private systemService!: SystemService;

    @inject(TYPES.WordMatchService)
    private wordMatchService!: WordMatchService;

    @inject(TYPES.SubtitleService)
    private subtitleService!: SubtitleService;

    /**
     * key: clipKey = hash(clip srt context)
     */
    private taskQueue: Map<string, LearningClipTask> = new Map();

    // todo 改用 cacheService 存储, 无需过期时间，我会在其他业务逻辑中主动清理
    private clipAnalysisCache: Map<string, { generatedAt: number; candidates: ClipCandidate[] }> = new Map();
    private clipAnalysisPromises: Map<string, Promise<ClipCandidate[]>> = new Map();
    private clipAnalysisProgress: Map<string, number> = new Map();
    private clipAnalysisExecution: Promise<void> = Promise.resolve();

    // todo 改用 cacheService 存储, 无需过期时间，我会在其他业务逻辑中主动清理
    private readonly clipAnalysisCacheTtl = 2 * 60 * 1000; // 2 minutes

    private getSrtFromCache(srtKey: string): SrtCache | null {
        return (this.cacheService.get('cache:srt', srtKey) as SrtCache) ?? null;
    }

    public async autoClip(videoPath: string, srtKey: string, srtPath?: string): Promise<void> {
        const srt = await this.ensureSrtCached(srtKey, srtPath);
        if (!srt) {
            throw new Error(ErrorConstants.CACHE_NOT_FOUND);
        }

        const resolvedSrtPath = srt.filePath || srtPath || undefined;

        const analysisKey = this.mapAnalysisKey(videoPath, srtKey);
        const candidates = await this.collectClipCandidates(videoPath, srtKey, { srtPath: resolvedSrtPath });

        if (candidates.length === 0) {
            await this.notifyClipStatus(videoPath, srtKey, 'completed', 0, 0, 0, 100);
            return;
        }

        const candidateKeys = candidates.map((candidate) => candidate.clipKey);

        const existingRows = candidateKeys.length > 0
            ? await db
                .select({ key: videoLearningClip.key })
                .from(videoLearningClip)
                .where(inArray(videoLearningClip.key, candidateKeys))
            : [];

        const existingKeySet = new Set(existingRows.map((row) => row.key));
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

        // 清理旧的分析缓存，确保下一次分析使用最新结果
        this.clipAnalysisCache.delete(analysisKey);

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

    public async cancelAddLearningClip(srtKey: string, indexInSrt: number): Promise<void> {
        const clipKey = this.mapToClipKey(srtKey, indexInSrt);
        const existingTask = this.taskQueue.get(clipKey);
        const cachedSrt = this.getSrtFromCache(srtKey);
        this.taskQueue.set(clipKey, {
            videoPath: '',
            srtKey,
            indexInSrt,
            matchedWords: [],
            clipKey,
            operation: 'cancel',
            srtPath: existingTask?.srtPath ?? cachedSrt?.filePath,
        });
    }

    private mapToClipKey(srtKey: string, indexInSrt: number): string {
        const srt = this.getSrtFromCache(srtKey);
        if (!srt) {
            throw new Error(ErrorConstants.CACHE_NOT_FOUND);
        }
        const srtLines: SrtLine[] = srt.sentences.map((sentence) => SrtUtil.fromSentence(sentence));
        const clipContext = SrtUtil.getAround(srtLines, indexInSrt, 5);
        const contentSrtStr = SrtUtil.srtLinesToSrt(clipContext);
        return hash(contentSrtStr);
    }

    private mapAnalysisKey(videoPath: string, srtKey: string): string {
        return `${videoPath}::${srtKey}`;
    }

    private mapToClipKeyFromLines(srtLines: SrtLine[], indexInSrt: number): string {
        const clipContext = SrtUtil.getAround(srtLines, indexInSrt, 5);
        const contentSrtStr = SrtUtil.srtLinesToSrt(clipContext);
        return hash(contentSrtStr);
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
            dpLog.error('[VideoLearningServiceImpl] failed to parse srt for cache', {
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

        const snapshot = new Map(this.taskQueue); // 快照，避免遍历中被修改
        const keys = Array.from(snapshot.keys());

        if (keys.length === 0) return;

        const existingRows = await db
            .select({ key: videoLearningClip.key })
            .from(videoLearningClip)
            .where(inArray(videoLearningClip.key, keys));

        const existingKeys = new Set(existingRows.map((r) => r.key));
        const notExistingKeys = keys.filter((k) => !existingKeys.has(k));

        // 用于通知
        let processedSrtKey = '';
        let processedVideoPath = '';

        // 处理新增任务：仅针对数据库中不存在的键
        for (const key of notExistingKeys) {
            const task = snapshot.get(key);
            if (!task) {
                dpLog.error('[checkQueue] task not found for key:', key);
                continue;
            }
            if (task.operation === 'add') {
                processedSrtKey = task.srtKey;
                processedVideoPath = task.videoPath;
                await this.taskAddOperation(task);
            }
            // 从真实队列中删除该任务（如果没有被新的任务覆盖）
            if (this.taskQueue.get(key) === task) {
                this.taskQueue.delete(key);
            }
        }

        // 处理取消任务：仅针对数据库中存在的键
        for (const key of existingKeys) {
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
        const key = this.mapToMetaKey(srt, task.indexInSrt);

        const folder = this.locationService.getDetailLibraryPath(LocationType.TEMP);
        if (!fs.existsSync(folder)) {
            fs.mkdirSync(folder, { recursive: true });
        }
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
            dpLog.warn('[taskAddOperation] failed to remove temp file:', tempName, e);
        }
    }

    public async taskCancelOperation(task: LearningClipTask): Promise<void> {
        const srt = await this.ensureSrtCached(task.srtKey, task.srtPath);
        if (!srt) return;
        const key = this.mapToMetaKey(srt, task.indexInSrt);
        await this.deleteLearningClip(key);
    }

    private mapTrimRange(srt: SrtCache, indexInSrt: number): [number, number] {
        const srtLines: SrtLine[] = srt.sentences.map((sentence) => SrtUtil.fromSentence(sentence));
        const clipContext = SrtUtil.getAround(srtLines, indexInSrt, 5);
        const startTime = clipContext[0].start ?? 0;
        const endTime = clipContext[clipContext.length - 1].end ?? 0;
        return [startTime, endTime];
    }

    private mapToMetaKey(srt: SrtCache, indexInSrt: number): string {
        const srtLines: SrtLine[] = srt.sentences.map((sentence) => SrtUtil.fromSentence(sentence));
        const clipContext = SrtUtil.getAround(srtLines, indexInSrt, 5);
        const contentSrtStr = SrtUtil.srtLinesToSrt(clipContext);
        return hash(contentSrtStr);
    }

    private async collectClipCandidates(
        videoPath: string,
        srtKey: string,
        options?: { onProgress?: (progress: number) => Promise<void> | void; srtPath?: string }
    ): Promise<ClipCandidate[]> {
        const analysisKey = this.mapAnalysisKey(videoPath, srtKey);
        const now = Date.now();

        const cached = this.clipAnalysisCache.get(analysisKey);
        if (cached && now - cached.generatedAt <= this.clipAnalysisCacheTtl) {
            return cached.candidates;
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

            const srtLines: SrtLine[] = srt.sentences.map((sentence) => SrtUtil.fromSentence(sentence));
            const contents = srtLines.map((line) => (line?.contentEn || '').toLowerCase());

            if (contents.length === 0) {
                return [];
            }

            const CHUNK_SIZE = 50;
            const matchResults: MatchedWord[][] = [];

            if (options?.onProgress) {
                this.clipAnalysisProgress.set(analysisKey, 0);
            }

            for (let i = 0; i < contents.length; i += CHUNK_SIZE) {
                const chunk = contents.slice(i, i + CHUNK_SIZE);
                const chunkResults = await this.wordMatchService.matchWordsInTexts(chunk);
                matchResults.push(...chunkResults);

                const progress = Math.min(99, Math.round(((i + chunk.length) / contents.length) * 100));
                if (options?.onProgress) {
                    this.clipAnalysisProgress.set(analysisKey, progress);
                    await options.onProgress(progress);
                }

                await new Promise((resolve) => setTimeout(resolve, 0));
            }

            const candidates: ClipCandidate[] = [];

            for (let i = 0; i < srtLines.length; i++) {
                const matches = matchResults[i] || [];
                if (!matches || matches.length === 0) {
                    continue;
                }

                const matchedWords = Array.from(
                    new Set(
                        matches
                            .map((m) => (m.databaseWord?.word || m.normalized || m.original || '').toLowerCase())
                            .filter(Boolean)
                    )
                );

                if (matchedWords.length === 0) {
                    continue;
                }

                const clipKey = this.mapToClipKeyFromLines(srtLines, i);
                candidates.push({
                    indexInSrt: i,
                    clipKey,
                    matchedWords,
                });
            }

            if (options?.onProgress) {
                this.clipAnalysisProgress.set(analysisKey, 100);
                await options.onProgress(100);
            }

            return candidates;
        };

        const scheduled = this.clipAnalysisExecution.then(compute);
        this.clipAnalysisExecution = scheduled.then(
            () => undefined,
            () => undefined
        );

        this.clipAnalysisPromises.set(analysisKey, scheduled);

        try {
            const candidates = await scheduled;
            this.clipAnalysisCache.set(analysisKey, { generatedAt: Date.now(), candidates });
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
        await db.delete(videoLearningClip).where(eq(videoLearningClip.key, key));
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
                const base = typeof entry.base === 'string' ? entry.base.toLowerCase().trim() : '';
                if (!base) {
                    return null;
                }
                const forms = new Set<string>();
                (entry.forms || []).forEach((form) => {
                    const normalizedForm = typeof form === 'string' ? form.toLowerCase().trim() : '';
                    if (normalizedForm) {
                        forms.add(normalizedForm);
                    }
                });
                if (!forms.size) {
                    forms.add(base);
                }
                return {
                    base,
                    forms: Array.from(forms)
                };
            })
            .filter((entry): entry is ClipVocabularyEntry => entry !== null);
    }

    private async buildVocabularyEntriesFromClip(
        clip: OssBaseMeta & ClipMeta & { sourceType: 'oss' | 'local' },
        baseWords: string[]
    ): Promise<ClipVocabularyEntry[]> {
        if (!clip?.clip_content || clip.clip_content.length === 0) {
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
        const englishLines = clip.clip_content
            .map((line) => line.contentEn || '')
            .filter((line) => typeof line === 'string' && line.trim().length > 0);

        if (englishLines.length === 0) {
            return normalizedBaseWords.map((base) => ({
                base,
                forms: [base]
            }));
        }

        const matchResults = await this.wordMatchService.matchWordsInTexts(englishLines);
        const entryMap = new Map<string, Set<string>>();

        matchResults.forEach((matches) => {
            matches.forEach((match) => {
                const base = (match.databaseWord?.word || match.normalized || match.stem || '').toLowerCase().trim();
                if (!base || !baseSet.has(base)) {
                    return;
                }
                const form = (match.original || match.normalized || '').toLowerCase().trim();
                if (!entryMap.has(base)) {
                    entryMap.set(base, new Set<string>());
                }
                if (form) {
                    entryMap.get(base)!.add(form);
                }
            });
        });

        baseSet.forEach((base) => {
            if (!entryMap.has(base)) {
                entryMap.set(base, new Set([base]));
            }
        });

        return Array.from(entryMap.entries()).map(([base, forms]) => ({
            base,
            forms: Array.from(forms)
        }));
    }

    private async getClipWordsMap(keys: string[]): Promise<Map<string, string[]>> {
        const result = new Map<string, string[]>();
        if (!keys || keys.length === 0) {
            return result;
        }

        const rows = await db
            .select({
                clipKey: videoLearningClipWord.clip_key,
                word: videoLearningClipWord.word
            })
            .from(videoLearningClipWord)
            .where(inArray(videoLearningClipWord.clip_key, keys));

        const tempMap = new Map<string, Set<string>>();
        for (const row of rows) {
            const cleanedWord = typeof row.word === 'string' ? row.word.toLowerCase().trim() : '';
            if (!cleanedWord) {
                continue;
            }
            if (!tempMap.has(row.clipKey)) {
                tempMap.set(row.clipKey, new Set());
            }
            tempMap.get(row.clipKey)?.add(cleanedWord);
        }

        tempMap.forEach((set, key) => {
            result.set(key, Array.from(set));
        });

        return result;
    }

    public async search({ word, page, pageSize }: SimpleClipQuery): Promise<VideoLearningClipPage> {
        const normalizedPageSize = Math.min(Math.max(pageSize ?? 12, 1), 100);
        const normalizedPage = Math.max(page ?? 1, 1);
        const offset = (normalizedPage - 1) * normalizedPageSize;
        const searchWord = StrUtil.isNotBlank(word) ? word.trim().toLowerCase() : '';

        const conditions: any[] = [];

        if (StrUtil.isNotBlank(searchWord)) {
            const clipKeysWithWord = await db
                .select({ clip_key: videoLearningClipWord.clip_key })
                .from(videoLearningClipWord)
                .where(eq(videoLearningClipWord.word, searchWord));

            const clipKeys = clipKeysWithWord.map(item => item.clip_key);

            if (clipKeys.length > 0) {
                conditions.push(inArray(videoLearningClip.key, clipKeys));
            } else {
                conditions.push(sql`1=0`);
            }
        }

        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

        const totalRows = await db
            .select({ count: sql<number>`count(*)` })
            .from(videoLearningClip)
            .where(whereClause);

        const dbTotal = Number(totalRows?.[0]?.count ?? 0);

        const inProgressTasks = Array.from(this.taskQueue.values())
            .filter(task => task.operation === 'add')
            .filter(task => {
                if (!searchWord) {
                    return true;
                }
                return task.matchedWords.some(matched => matched.toLowerCase() === searchWord);
            });

        const inProgressClips: Array<{ clip: OssBaseMeta & ClipMeta & { sourceType: 'local' }, matchedWords: string[] }> = [];
        for (const task of inProgressTasks) {
            try {
                const srt = this.getSrtFromCache(task.srtKey);
                if (!srt) continue;

                const metaData = this.mapToMetaData(task.videoPath, srt, task.indexInSrt);
                const key = this.mapToMetaKey(srt, task.indexInSrt);
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

                inProgressClips.push({
                    clip: clipEntry,
                    matchedWords: task.matchedWords ?? []
                });
            } catch (error) {
                dpLog.error('Failed to process in-progress task:', error);
            }
        }

        const inProgressVOs = await Promise.all(
            inProgressClips.map(async ({ clip, matchedWords }) => {
                const vocabulary = await this.buildVocabularyEntriesFromClip(clip, matchedWords ?? []);
                return this.convertToVideoLearningClipVO(clip, vocabulary);
            })
        );
        const inProgressCount = inProgressVOs.length;

        const start = offset;
        const end = offset + normalizedPageSize;

        const paginatedInProgress: VideoLearningClipVO[] = [];
        if (start < inProgressCount) {
            const inProgressEnd = Math.min(end, inProgressCount);
            paginatedInProgress.push(...inProgressVOs.slice(start, inProgressEnd));
        }

        const dbOffset = Math.max(0, start - inProgressCount);
        const dbLimit = Math.max(0, end - Math.max(start, inProgressCount));

        let completedVOs: VideoLearningClipVO[] = [];
        if (dbLimit > 0) {
            const lines: VideoLearningClip[] = await db
                .select({
                    key: videoLearningClip.key,
                    video_name: videoLearningClip.video_name,
                    srt_clip: videoLearningClip.srt_clip,
                    srt_context: videoLearningClip.srt_context,
                    created_at: videoLearningClip.created_at,
                    updated_at: videoLearningClip.updated_at,
                })
                .from(videoLearningClip)
                .where(whereClause)
                .orderBy(desc(videoLearningClip.created_at))
                .offset(dbOffset)
                .limit(dbLimit);

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
                        const vocabulary = await this.buildVocabularyEntriesFromClip(
                            clip,
                            wordMap.get(clip.key) ?? []
                        );
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

        await db.insert(videoLearningClip).values({
            key: metaData.key,
            video_name: metaData.video_name,
            srt_clip: srtClip,
            srt_context: srtContext,
            created_at: TimeUtil.timeUtc(),
            updated_at: TimeUtil.timeUtc()
        }).onConflictDoUpdate({
            target: [videoLearningClip.key],
            set: {
                video_name: metaData.video_name,
                srt_clip: srtClip,
                srt_context: srtContext,
                updated_at: TimeUtil.timeUtc()
            }
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
                await db.insert(videoLearningClipWord).values(wordRelations).onConflictDoNothing();
            }
        }
    }

    private async clipInDb(key: string) {
        const rows = await db.select().from(videoLearningClip).where(eq(videoLearningClip.key, key));
        return rows.length > 0;
    }

    /**
     * 清除数据库，重新从 OSS 同步
     */
    public async syncFromOss() {
        const keys = await this.videoLearningOssService.list();
        await db.delete(videoLearningClip).where(sql`1=1`);
        await db.delete(videoLearningClipWord).where(sql`1=1`);
        for (const key of keys) {
            const clip = await this.videoLearningOssService.get(key);
            if (!clip) continue;
            await this.addToDb(clip);
        }
    }

    public async countClipsGroupedByWord(): Promise<Record<string, number>> {
        const rows = await db
            .select({
                word: videoLearningClipWord.word,
                count: sql<number>`count(*)`
            })
            .from(videoLearningClipWord)
            .groupBy(videoLearningClipWord.word);

        const result: Record<string, number> = {};
        for (const row of rows) {
            result[row.word] = Number(row.count) || 0;
        }
        return result;
    }

    @postConstruct()
    public postConstruct() {
        const loop = async () => {
            try {
                await this.checkQueue();
            } catch (e) {
                dpLog.error('[VideoLearningServiceImpl] checkQueue error:', e);
            } finally {
                setTimeout(loop, 1000);
            }
        };
        // fire-and-forget
        loop().catch((e) => dpLog.error(e));
    }

    public async detectClipStatus(videoPath: string, srtKey: string, srtPath?: string): Promise<VideoLearningClipStatusVO> {
        const srt = await this.ensureSrtCached(srtKey, srtPath);
        if (!srt) {
            await this.notifyClipStatus(videoPath, srtKey, 'completed', 0, 0, 0, 100);
            return { status: 'completed' };
        }

        const resolvedSrtPath = srt.filePath || srtPath || undefined;

        await this.notifyClipStatus(videoPath, srtKey, 'analyzing', undefined, undefined, undefined, 0);

        let candidates: ClipCandidate[] = [];

        try {
            candidates = await this.collectClipCandidates(videoPath, srtKey, {
                onProgress: async (progress) => {
                    await this.notifyClipStatus(videoPath, srtKey, 'analyzing', undefined, undefined, undefined, progress);
                },
                srtPath: resolvedSrtPath,
            });
        } catch (error) {
            dpLog.error('分析裁切状态失败:', error);
            await this.notifyClipStatus(videoPath, srtKey, 'completed', 0, 0, 0, 100);
            return { status: 'completed' };
        }

        if (candidates.length === 0) {
            await this.notifyClipStatus(videoPath, srtKey, 'completed', 0, 0, 0, 100);
            return { status: 'completed' };
        }

        const candidateKeys = candidates.map((candidate) => candidate.clipKey);

        const [existingRows, queueSnapshot] = await Promise.all([
            candidateKeys.length > 0
                ? db
                    .select({ key: videoLearningClip.key })
                    .from(videoLearningClip)
                    .where(inArray(videoLearningClip.key, candidateKeys))
                : Promise.resolve([] as { key: string }[]),
            Promise.resolve(
                Array.from(this.taskQueue.values()).filter(
                    (task) => task.operation === 'add' && task.srtKey === srtKey,
                ),
            ),
        ]);

        const existingKeySet = new Set(existingRows.map((row) => row.key));
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

            const cacheKey = `clip-status:${videoPath}:${srtKey}`;
            const cacheTtl = status === 'analyzing' ? 30 * 1000 : this.clipAnalysisCacheTtl;
            this.cacheService.set('cache:clip-status', cacheKey, cachePayload, cacheTtl);

            await this.systemService.callRendererApi('video-learning/clip-status-update', {
                videoPath,
                srtKey,
                status,
                pendingCount,
                inProgressCount,
                completedCount,
                message,
                analyzingProgress
            });
        } catch (error) {
            dpLog.error('Failed to notify clip status:', error);
        }
    }
}
