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

import { ClipMeta, ClipSrtLine, OssBaseMeta } from '@/common/types/clipMeta';
import { VideoLearningClipVO } from '@/common/types/vo/VideoLearningClipVO';
import { VideoLearningClipStatusVO } from '@/common/types/vo/VideoLearningClipStatusVO';
import { WordMatchService } from '@/backend/services/WordMatchService';

type SrtCache = {
    sentences: any[];
};

type LearningClipTask = {
    videoPath: string;
    srtKey: string;
    indexInSrt: number;
    matchedWords: string[];
    clipKey: string;
    operation: 'add' | 'cancel';
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

    /**
     * key: clipKey = hash(clip srt context)
     */
    private taskQueue: Map<string, LearningClipTask> = new Map();

    private getSrtFromCache(srtKey: string): SrtCache | null {
        return (this.cacheService.get('cache:srt', srtKey) as SrtCache) ?? null;
    }

    public async autoClip(videoPath: string, srtKey: string): Promise<void> {
        const srt = this.getSrtFromCache(srtKey);
        if (!srt) {
            throw new Error(ErrorConstants.CACHE_NOT_FOUND);
        }

        // 预处理所有行，使用批量词匹配
        const srtLines: SrtLine[] = srt.sentences.map((sentence) => SrtUtil.fromSentence(sentence));
        const contents = srtLines.map((line) => (line?.contentEn || '').toLowerCase());
        const matchResults = await this.wordMatchService.matchWordsInTexts(contents);

        let addedCountForThisSrt = 0;

        for (let i = 0; i < srtLines.length; i++) {
            const matches = (matchResults[i] || []) as any[];
            const matchedWords = Array.from(
                new Set(
                    matches
                        .map(m => (m.databaseWord?.word || m.normalized || m.original || '').toLowerCase())
                        .filter(Boolean)
                )
            );

            if (matchedWords.length > 0) {
                const clipKey = this.mapToClipKey(srtKey, i);
                this.taskQueue.set(clipKey, {
                    videoPath,
                    srtKey,
                    indexInSrt: i,
                    matchedWords,
                    clipKey,
                    operation: 'add'
                });
                addedCountForThisSrt++;
            }
        }

        await this.notifyClipStatus(videoPath, srtKey, 'in_progress', 0, addedCountForThisSrt, 0);
    }

    public async cancelAddLearningClip(srtKey: string, indexInSrt: number): Promise<void> {
        const clipKey = this.mapToClipKey(srtKey, indexInSrt);
        this.taskQueue.set(clipKey, {
            videoPath: '',
            srtKey,
            indexInSrt,
            matchedWords: [],
            clipKey,
            operation: 'cancel'
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
        const srt = this.getSrtFromCache(task.srtKey);
        if (!srt) return;

        const metaData = this.mapToMetaData(task.videoPath, srt, task.indexInSrt, task.matchedWords);
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
        const srt = this.getSrtFromCache(task.srtKey);
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

    private mapToMetaData(videoPath: string, srt: SrtCache, indexInSrt: number, matchedWords: string[]): ClipMeta {
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
        clip: OssBaseMeta & ClipMeta & { sourceType: 'oss' | 'local' }
    ): VideoLearningClipVO {
        // 正在处理中：返回原视频路径，时间需要加上偏移量
        // 已处理完成：返回OSS片段路径，时间是相对片段的
        const videoPath = clip.sourceType === 'local' ? clip.video_name :
                        (clip.baseDir && clip.clip_file ? `${clip.baseDir}/${clip.clip_file}` : clip.video_name);

        // 后端直接返回处理好的时间，前端不用计算
        const processedClipContent = (clip.clip_content ?? []).map(item => ({
            index: item.index,
            start: clip.sourceType === 'local' ? (this.getClipBeginAt(clip) + item.start) : item.start,
            end: clip.sourceType === 'local' ? (this.getClipBeginAt(clip) + item.end) : item.end,
            contentEn: item.contentEn,
            contentZh: item.contentZh,
            isClip: item.isClip
        }));

        return {
            key: clip.key,
            sourceType: clip.sourceType,
            videoName: clip.video_name,
            videoPath: videoPath,
            createdAt: clip.created_at,
            clipContent: processedClipContent
        };
    }

    private getClipBeginAt(clip: OssBaseMeta & ClipMeta): number {
        // 从 clip_content 中获取第一个句子的 start 时间，作为原视频的起始时间
        const firstLine = clip.clip_content?.[0];
        return firstLine?.start || 0;
    }

    public async search({word}: SimpleClipQuery): Promise<VideoLearningClipVO[]> {
        const conditions: any[] = [];

        if (word && StrUtil.isNotBlank(word)) {
            // 通过关联表查询匹配的单词
            const clipKeysWithWord = await db
                .select({ clip_key: videoLearningClipWord.clip_key })
                .from(videoLearningClipWord)
                .where(eq(videoLearningClipWord.word, word.toLowerCase()));

            const clipKeys = clipKeysWithWord.map(item => item.clip_key);

            if (clipKeys.length > 0) {
                conditions.push(inArray(videoLearningClip.key, clipKeys));
            } else {
                // 强制无结果
                conditions.push(sql`1=0`);
            }
        }

        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

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
            .limit(5000);

        const ossMetas = await Promise.all(
            lines.map((line) => this.videoLearningOssService.get(line.key))
        );
        const completedClips = ossMetas.filter((m): m is OssBaseMeta & ClipMeta => m !== null);

        // 已完成的片段添加 sourceType
        const completedWithSourceType = completedClips.map(clip => ({
            ...clip,
            sourceType: 'oss' as const
        }));

        // 获取进行中的任务（在 taskQueue 中的 add 操作）
        const inProgressTasks = Array.from(this.taskQueue.values())
            .filter(task => task.operation === 'add');

        if (inProgressTasks.length === 0) {
            return completedWithSourceType.map(clip =>
                this.convertToVideoLearningClipVO(clip)
            );
        }

        // 将进行中的任务转换为 ClipMeta 格式
        const inProgressClips: (OssBaseMeta & ClipMeta & { sourceType: 'local' })[] = [];
        for (const task of inProgressTasks) {
            try {
                const srt = this.getSrtFromCache(task.srtKey);
                if (!srt) continue;

                const metaData = this.mapToMetaData(task.videoPath, srt, task.indexInSrt, task.matchedWords);
                const key = this.mapToMetaKey(srt, task.indexInSrt);

                inProgressClips.push({
                    ...metaData,
                    key,
                    sourceType: 'local' as const,
                    version: 1,
                    clip_file: task.videoPath,
                    thumbnail_file: '',
                    baseDir: ''
                } as unknown as OssBaseMeta & ClipMeta & { sourceType: 'local' });
            } catch (error) {
                dpLog.error('Failed to process in-progress task:', error);
            }
        }

        // 转换为 VO 格式，进行中的排在前面
        const inProgressVOs = inProgressClips.map(clip =>
            this.convertToVideoLearningClipVO(clip)
        );
        const completedVOs = completedWithSourceType.map(clip =>
            this.convertToVideoLearningClipVO(clip)
        );

        return [...inProgressVOs, ...completedVOs];
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

    public async detectClipStatus(videoPath: string, srtKey: string): Promise<VideoLearningClipStatusVO> {
        const srt = this.getSrtFromCache(srtKey);
        if (!srt) {
            return { status: 'completed' };
        }

        const srtLines: SrtLine[] = srt.sentences.map((sentence) => SrtUtil.fromSentence(sentence));
        const contents = srtLines.map((line) => (line?.contentEn || '').toLowerCase());

        // 1. 批量算法匹配
        const matchResults = await this.wordMatchService.matchWordsInTexts(contents);

        // 2. 收集所有匹配到的行的 clipKey
        const matchedKeys: string[] = [];
        for (let i = 0; i < matchResults.length; i++) {
            const words = matchResults[i] || [];
            if (words.length > 0) {
                matchedKeys.push(this.mapToClipKey(srtKey, i));
            }
        }

        if (matchedKeys.length === 0) {
            await this.notifyClipStatus(videoPath, srtKey, 'completed', 0, 0, 0);
            return { status: 'completed' };
        }

        // 3. 一次性查询数据库和任务队列
        const [existingRows, inQueueAddKeys] = await Promise.all([
            db.select({ key: videoLearningClip.key })
              .from(videoLearningClip)
              .where(inArray(videoLearningClip.key, matchedKeys)),
            Promise.resolve(
                new Set(
                    Array.from(this.taskQueue.values())
                        .filter(t => t.operation === 'add' && t.srtKey === srtKey)
                        .map(t => t.clipKey)
                )
            )
        ]);

        const existingKeySet = new Set(existingRows.map(r => r.key));

        // 4. 分类统计
        let inProgressCount = 0;
        let completedCount = 0;
        let pendingCount = 0;

        for (const key of matchedKeys) {
            if (inQueueAddKeys.has(key)) {
                inProgressCount++;
            } else if (existingKeySet.has(key)) {
                completedCount++;
            } else {
                pendingCount++;
            }
        }

        let status: 'pending' | 'in_progress' | 'completed';
        if (inProgressCount > 0) {
            status = 'in_progress';
        } else if (pendingCount > 0) {
            status = 'pending';
        } else {
            status = 'completed';
        }

        await this.notifyClipStatus(videoPath, srtKey, status, pendingCount, inProgressCount, completedCount);

        return {
            status,
            pendingCount: pendingCount > 0 ? pendingCount : undefined,
            inProgressCount: inProgressCount > 0 ? inProgressCount : undefined,
            completedCount: completedCount > 0 ? completedCount : undefined
        };
    }

    private async notifyClipStatus(
        videoPath: string,
        srtKey: string,
        status: 'pending' | 'in_progress' | 'completed',
        pendingCount?: number,
        inProgressCount?: number,
        completedCount?: number
    ): Promise<void> {
        try {
            let message = '';
            if (status === 'pending') {
                message = `发现 ${pendingCount ?? 0} 个需要裁切的学习片段`;
            } else if (status === 'in_progress') {
                message = `正在裁切 ${inProgressCount ?? 0} 个学习片段`;
            } else {
                message = '所有学习片段已裁切完成';
            }

            await this.systemService.callRendererApi('video-learning/clip-status-update', {
                videoPath,
                srtKey,
                status,
                pendingCount,
                inProgressCount,
                completedCount,
                message
            });
        } catch (error) {
            dpLog.error('Failed to notify clip status:', error);
        }
    }
}
