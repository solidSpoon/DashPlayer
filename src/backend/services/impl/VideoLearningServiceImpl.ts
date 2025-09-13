import hash from 'object-hash';
import path from 'path';
import db from '@/backend/db';
import { VideoLearningClip, videoLearningClip } from '@/backend/db/tables/videoLearningClip';
import TimeUtil from '@/common/utils/TimeUtil';
import { and, count, desc, eq, gte, inArray, isNull, like, lte, or, sql } from 'drizzle-orm';
import fs from 'fs';
import ErrorConstants from '@/common/constants/error-constants';
import { inject, injectable, postConstruct } from 'inversify';
import TYPES from '@/backend/ioc/types';
import { videoLearningClipWord, InsertVideoLearningClipWord } from '@/backend/db/tables/videoLearningClipWord';
import { ClipQuery } from '@/common/api/dto';
import StrUtil from '@/common/utils/str-util';
import { SrtSentence } from '@/common/types/SentenceC';
import { VideoLearningService } from '@/backend/services/VideoLearningService';
import dpLog from '@/backend/ioc/logger';
import CacheService from '@/backend/services/CacheService';
import LocationService, { LocationType } from '@/backend/services/LocationService';
import { ClipOssService } from '@/backend/services/OssService';
import FfmpegService from '@/backend/services/FfmpegService';
import SystemService from '@/backend/services/SystemService';
import { ClipMeta, ClipSrtLine, OssBaseMeta } from '@/common/types/clipMeta';
import { VideoLearningClipVO } from '@/common/types/vo/VideoLearningClipVO';
import { VideoLearningClipStatusVO } from '@/common/types/vo/VideoLearningClipStatusVO';
import SrtUtil, { SrtLine } from "@/common/utils/SrtUtil";
import { words } from '@/backend/db/tables/words';

type LearningClipTask = {
    videoPath: string,
    srtKey: string,
    indexInSrt: number,
    matchedWords: string[],
    clipKey: string,
    operation: 'add' | 'cancel'
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

    /**
     * key: hash(srtContext)
     * @private
     */
    private taskQueue: Map<string, LearningClipTask> = new Map();

    public async autoClip(videoPath: string, srtKey: string): Promise<void> {
        const srt = this.cacheService.get('cache:srt', srtKey);
        if (!srt) {
            throw new Error(ErrorConstants.CACHE_NOT_FOUND);
        }

        // 从数据库获取所有单词
        const allWords = await db.select().from(words);
        const wordSet = new Set(allWords.map(w => w.word.toLowerCase()));

        // 遍历字幕，查找包含目标单词的行
        for (let i = 0; i < srt.sentences.length; i++) {
            const sentence = srt.sentences[i];
            const content = sentence.text.toLowerCase();

            // 检查是否包含任何单词表中的单词
            const matchedWords: string[] = [];
            for (const word of wordSet) {
                if (content.includes(word)) {
                    matchedWords.push(word);
                }
            }

            if (matchedWords.length > 0) {
                // 添加到任务队列
                const clipKey = this.mapToClipKey(srtKey, i);
                this.taskQueue.set(clipKey, {
                    videoPath,
                    srtKey,
                    indexInSrt: i,
                    matchedWords,
                    clipKey,
                    operation: 'add'
                });
            }
        }

        // 通知状态更新为进行中
        await this.notifyClipStatus(videoPath, srtKey, 'in_progress', 0, this.taskQueue.size, 0);
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
        const srt = this.cacheService.get('cache:srt', srtKey);
        if (!srt) {
            throw new Error(ErrorConstants.CACHE_NOT_FOUND);
        }
        const srtLines: SrtLine[] = srt.sentences
            .map((sentence) => SrtUtil.fromSentence(sentence));
        const clipContext = SrtUtil.getAround(srtLines, indexInSrt, 5);
        const contentSrtStr = SrtUtil.srtLinesToSrt(clipContext);
        return hash(contentSrtStr);
    }

    /**
     * 定时任务
     */
    async checkQueue() {
        if (this.taskQueue.size === 0) {
            return;
        }
        const tempMapping = new Map(this.taskQueue);
        const newKeys = Array.from(tempMapping.keys());

        const exists = await db.select().from(videoLearningClip).where(inArray(videoLearningClip.key, newKeys));
        const existsKeys = exists.map((item) => item.key);
        const notExistKeys = newKeys.filter((key) => !existsKeys.includes(key));

        let processedVideoPath = '';
        let processedSrtKey = '';

        for (const k of notExistKeys) {
            const task = tempMapping.get(k);
            if (!task) {
                dpLog.error('task not found');
                continue;
            }
            if (task.operation === 'add') {
                processedVideoPath = task.videoPath;
                processedSrtKey = task.srtKey;
                await this.taskAddOperation(task);
            }
            if (this.taskQueue.get(k) === task) {
                this.taskQueue.delete(k);
            }
        }
        for (const k of existsKeys) {
            const task = tempMapping.get(k);
            if (!task) {
                dpLog.error('task not found');
                continue;
            }
            if (task.operation === 'cancel') {
                processedVideoPath = task.videoPath;
                processedSrtKey = task.srtKey;
                await this.taskCancelOperation(task);
            }
            if (this.taskQueue.get(k) === task) {
                this.taskQueue.delete(k);
            }
        }

        // 如果有任务被处理，通知状态更新
        if (processedVideoPath && processedSrtKey) {
            // 检查剩余任务数量
            const remainingTasks = Array.from(this.taskQueue.values()).filter(t => t.operation === 'add');
            if (remainingTasks.length === 0) {
                // 所有任务完成
                await this.notifyClipStatus(processedVideoPath, processedSrtKey, 'completed', 0, 0, 1);
            } else {
                // 仍有任务在进行中
                await this.notifyClipStatus(processedVideoPath, processedSrtKey, 'in_progress', 0, remainingTasks.length, 0);
            }
        }
    }

    private async taskAddOperation(task: LearningClipTask): Promise<void> {
        const srt = this.cacheService.get('cache:srt', task.srtKey);
        if (!srt) {
            return;
        }
        const metaData = this.mapToMetaData(task.videoPath, srt, task.indexInSrt, task.matchedWord);
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
            throw new Error('meta not found');
        }
        await this.addToDb(meta);
        fs.rmSync(tempName);
    }

    public async taskCancelOperation(task: LearningClipTask): Promise<void> {
        const srt = this.cacheService.get('cache:srt', task.srtKey);
        if (!srt) {
            return;
        }
        const key = this.mapToMetaKey(srt, task.indexInSrt);
        await this.deleteLearningClip(key);
    }

    private mapTrimRange(srt: SrtSentence, indexInSrt: number): [number, number] {
        const srtLines: SrtLine[] = srt.sentences
            .map((sentence) => SrtUtil.fromSentence(sentence));
        const clipContext = SrtUtil.getAround(srtLines, indexInSrt, 5);
        const startTime = clipContext[0].start ?? 0;
        return [startTime, clipContext[clipContext.length - 1].end ?? 0];
    }

    private mapToMetaKey(srt: SrtSentence, indexInSrt: number): string {
        const srtLines: SrtLine[] = srt.sentences
            .map((sentence) => SrtUtil.fromSentence(sentence));
        const clipContext = SrtUtil.getAround(srtLines, indexInSrt, 5);
        const contentSrtStr = SrtUtil.srtLinesToSrt(clipContext);
        return hash(contentSrtStr);
    }

    private mapToMetaData(videoPath: string, srt: SrtSentence, indexInSrt: number, matchedWord: string): ClipMeta {
        const srtLines: SrtLine[] = srt.sentences
            .map((sentence) => SrtUtil.fromSentence(sentence));
        const clipContext = SrtUtil.getAround(srtLines, indexInSrt, 5);
        const clipLine = SrtUtil.findByIndex(srtLines, indexInSrt) as SrtLine;
        clipContext.map((item) =>
            item.contentEn
        ).filter((item) => StrUtil.isNotBlank(item)).join('\n');
        const startTime = clipContext[0].start ?? 0;
        const clipJson: ClipSrtLine[] = clipContext.map((item, index) => ({
            index: index,
            start: item.start - startTime,
            end: item.end - startTime,
            contentEn: item.contentEn,
            contentZh: item.contentZh,
            isClip: item === clipLine
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
        return {
            key: clip.key,
            sourceType: clip.sourceType,
            videoName: clip.video_name,
            videoPath: clip.sourceType === 'local' ? clip.clip_file : '',
            createdAt: clip.created_at,
            clipContent: clip.clip_content.map(item => ({
                index: item.index,
                start: item.start,
                end: item.end,
                contentEn: item.contentEn,
                contentZh: item.contentZh,
                isClip: item.isClip
            }))
        };
    }

    public async search({
                            keyword,
                            keywordRange,
                            date,
                            matchedWord
                        }: ClipQuery & { matchedWord?: string }): Promise<VideoLearningClipVO[]> {
        let where1 = and(sql`1=1`);
        if (StrUtil.isNotBlank(keyword)) {
            if (keywordRange === 'context') {
                where1 = and(like(videoLearningClip.srt_context, `%${keyword}%`));
            } else {
                where1 = and(like(videoLearningClip.srt_clip, `%${keyword}%`));
            }
        }
        if (matchedWord) {
            // 通过关联表查询匹配的单词
            const clipKeysWithWord = await db.select({ clip_key: videoLearningClipWord.clip_key })
                .from(videoLearningClipWord)
                .where(eq(videoLearningClipWord.word, matchedWord.toLowerCase()));
            const clipKeys = clipKeysWithWord.map(item => item.clip_key);

            if (clipKeys.length > 0) {
                where1 = and(where1, inArray(videoLearningClip.key, clipKeys));
            } else {
                // 如果没有匹配的片段，返回空结果
                where1 = and(sql`1=0`);
            }
        }
        if (date?.from) {
            where1 = and(where1, gte(videoLearningClip.created_at, TimeUtil.dateToUtc(date.from)));
        }
        if (date?.to) {
            where1 = and(where1, lte(videoLearningClip.created_at, TimeUtil.dateToUtc(date.to)));
        }

        const lines: VideoLearningClip[] = await db
            .select({
                key: videoLearningClip.key,
                video_name: videoLearningClip.video_name,
                srt_clip: videoLearningClip.srt_clip,
                srt_context: videoLearningClip.srt_context,
                created_at: videoLearningClip.created_at,
                updated_at: videoLearningClip.updated_at,
            }).from(videoLearningClip)
            .where(where1)
            .orderBy(desc(videoLearningClip.created_at))
            .limit(5000);

        const completedClips = await Promise.all(lines
            .map((line) => this.videoLearningOssService.get(line.key)))
            .then((res) => res.filter((item) => item !== null)) as Promise<(OssBaseMeta & ClipMeta)[]>;

        // 为已完成的片段添加sourceType标记
        const completedWithSourceType = completedClips.map(clip => ({
            ...clip,
            sourceType: 'oss' as const
        }));

        // 获取进行中的任务（在taskQueue中的add操作）
        const inProgressTasks = Array.from(this.taskQueue.values())
            .filter(task => task.operation === 'add');

        if (inProgressTasks.length === 0) {
            return completedWithSourceType.map(clip =>
                this.convertToVideoLearningClipVO(clip)
            );
        }

        // 将进行中的任务转换为ClipMeta格式
        const inProgressClips: (OssBaseMeta & ClipMeta & { sourceType: 'local' })[] = [];
        for (const task of inProgressTasks) {
            try {
                const srt = this.cacheService.get('cache:srt', task.srtKey);
                if (!srt) continue;

                const metaData = this.mapToMetaData(task.videoPath, srt, task.indexInSrt, '');
                const key = this.mapToMetaKey(srt, task.indexInSrt);

                inProgressClips.push({
                    ...metaData,
                    key,
                    sourceType: 'local' as const,
                    version: 1, // 添加版本号
                    clip_file: task.videoPath, // 使用原始视频路径作为clip_file
                    thumbnail_file: '', // 处理中无缩略图
                    baseDir: '', // 本地视频不需要baseDir
                    // 标记为进行中状态
                    clip_content: metaData.clip_content?.map(item => ({
                        ...item,
                        // 可以在这里添加进行中的标记
                    })) || []
                });
            } catch (error) {
                dpLog.error('Failed to process in-progress task:', error);
            }
        }

        // 转换为VO格式，进行中的排在前面
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

        // 从 taskQueue 中获取 matchedWords
        const task = Array.from(this.taskQueue.values()).find(t => t.clipKey === metaData.key);

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

        // 插入单词关系
        if (task?.matchedWords && task.matchedWords.length > 0) {
            const wordRelations: InsertVideoLearningClipWord[] = task.matchedWords.map(word => ({
                clip_key: metaData.key,
                word: word.toLowerCase(),
                created_at: TimeUtil.timeUtc(),
                updated_at: TimeUtil.timeUtc()
            }));
            await db.insert(videoLearningClipWord).values(wordRelations).onConflictDoNothing();
        }
    }

    private async clipInDb(key: string) {
        return (await db.select().from(videoLearningClip).where(eq(videoLearningClip.key, key)))
            .length > 0;
    }

    /**
     * 清除数据库，重新从oss同步
     */
    async syncFromOss() {
        const keys = await this.videoLearningOssService.list();
        await db.delete(videoLearningClip).where(sql`1=1`);
        await db.delete(videoLearningClipWord).where(sql`1=1`);
        for (const key of keys) {
            const clip = await this.videoLearningOssService.get(key);
            if (!clip) {
                continue;
            }
            await this.addToDb(clip);
        }
    }

    @postConstruct()
    public postConstruct() {
        const func = async () => {
            // dpLog.info('VideoLearningServiceImpl task start');
            await this.checkQueue();
            setTimeout(func, 1000);
        };
        func().catch((e) => {
            dpLog.error(e);
        });
    }

    public async detectClipStatus(videoPath: string, srtKey: string): Promise<VideoLearningClipStatusVO> {
        const srt = this.cacheService.get('cache:srt', srtKey);
        if (!srt) {
            return { status: 'completed' };
        }

        // 从数据库获取所有单词
        const allWords = await db.select().from(words);
        const wordSet = new Set(allWords.map(w => w.word.toLowerCase()));

        let pendingCount = 0;
        let inProgressCount = 0;
        let completedCount = 0;

        // 遍历字幕，统计各种状态
        for (let i = 0; i < srt.sentences.length; i++) {
            const sentence = srt.sentences[i];
            const content = sentence.text.toLowerCase();

            // 检查是否包含任何单词表中的单词
            const matchedWords: string[] = [];
            for (const word of wordSet) {
                if (content.includes(word)) {
                    matchedWords.push(word);
                }
            }

            if (matchedWords.length > 0) {
                const clipKey = this.mapToClipKey(srtKey, i);

                // 检查是否在任务队列中（处理中）
                const taskInQueue = this.taskQueue.get(clipKey);
                if (taskInQueue && taskInQueue.operation === 'add') {
                    inProgressCount++;
                    continue;
                }

                // 检查是否已经在数据库中（已完成）
                const existsInDb = await this.clipInDb(clipKey);
                if (existsInDb) {
                    completedCount++;
                } else {
                    pendingCount++;
                }
            }
        }

        // 确定整体状态
        let status: 'pending' | 'in_progress' | 'completed';
        if (inProgressCount > 0) {
            status = 'in_progress';
        } else if (pendingCount > 0) {
            status = 'pending';
        } else {
            status = 'completed';
        }

        // 通知前端状态更新
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
                message = `发现 ${pendingCount} 个需要裁切的学习片段`;
            } else if (status === 'in_progress') {
                message = `正在裁切 ${inProgressCount} 个学习片段`;
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
