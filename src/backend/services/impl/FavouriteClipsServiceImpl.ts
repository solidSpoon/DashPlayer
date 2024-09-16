import LocalOssService from '@/backend/services/LocalOssService';
import SrtUtil, { SrtLine } from '@/common/utils/SrtUtil';
import hash from 'object-hash';
import FfmpegService from '@/backend/services/FfmpegService';
import path from 'path';
import { MetaData, OssObject } from '@/common/types/OssObject';
import db from '@/backend/db';
import { VideoClip, videoClip } from '@/backend/db/tables/videoClip';
import TimeUtil from '@/common/utils/TimeUtil';
import { and, count, desc, eq, gte, inArray, isNull, like, lte, or, sql } from 'drizzle-orm';
import LocationService, { LocationType } from '@/backend/services/LocationService';
import fs from 'fs';
import ErrorConstants from '@/common/constants/error-constants';
import { inject, injectable, postConstruct } from 'inversify';
import TYPES from '@/backend/ioc/types';
import { tag, Tag } from '@/backend/db/tables/tag';
import { clipTagRelation } from '@/backend/db/tables/clipTagRelation';
import { ClipQuery } from '@/common/api/dto';
import StrUtil from '@/common/utils/str-util';
import CacheService from '@/backend/services/CacheService';
import { SrtSentence } from '@/common/types/SentenceC';
import { SerialTaskQueue, TaskQueue } from '@/common/objs/TaskQueue';
import dpLog from '@/backend/ioc/logger';
import { FavouriteClipsService } from '@/backend/services/FavouriteClipsService';

type ClipTask = {
    videoPath: string,
    srtKey: string,
    indexInSrt: number,
};
@injectable()
export default class FavouriteClipsServiceImpl implements FavouriteClipsService {
    @inject(TYPES.LocalOss)
    private ossService: LocalOssService;

    @inject(TYPES.CacheService)
    private cacheService: CacheService;

    private taskQueue: TaskQueue<ClipTask> = new SerialTaskQueue();

    public static mapKey(srtKey: string, indexInSrt: number): string {
        return srtKey + '::=::' + indexInSrt;
    }

    public async addClip(videoPath: string, srtKey: string, indexInSrt: number): Promise<void> {
        const key = FavouriteClipsServiceImpl.mapKey(srtKey, indexInSrt);
        if (this.taskQueue.info(key)) {
            throw new Error(ErrorConstants.CLIP_EXISTS);
        }
        if (await this.clipInDb(key)) {
            throw new Error(ErrorConstants.CLIP_EXISTS);
        }

        this.taskQueue.enqueueAdd(key, {
            videoPath,
            srtKey,
            indexInSrt
        });
    }

    /**
     * 定时任务
     */
    async checkQueue() {
        dpLog.info('FavouriteClipsServiceImpl checkQueue');
        for await (const { operation, task } of this.taskQueue.consume()) {
            if (operation === 'add') {
                dpLog.info('FavouriteClipsServiceImpl addOperation', task);
                await this.taskAddOperation(task);
            }
            if (operation === 'cancel') {
                dpLog.info('FavouriteClipsServiceImpl cancelOperation', task);
                await this.taskCancelOperation(task);
            }
        }
        dpLog.info('FavouriteClipsServiceImpl checkQueue end');
    }

    private async taskAddOperation(task: ClipTask): Promise<void> {
        const srt = this.cacheService.get<SrtSentence>(task.srtKey);
        if (!srt) {
            return;
        }
        const metaData = this.mapToMetaData(task.videoPath, srt, task.indexInSrt);
        const key = metaData.key;
        const folder = LocationService.getStoragePath(LocationType.TEMP);
        if (!fs.existsSync(folder)) {
            fs.mkdirSync(folder, { recursive: true });
        }
        const tempName = path.join(folder, key + '.mp4');
        if (await this.clipInDb(key)) {
            return;
        }
        await FfmpegService.trimVideo(task.videoPath, metaData.start_time, metaData.end_time, tempName);
        await this.ossService.put(key, tempName, metaData);
        await this.addToDb(metaData);
        fs.rmSync(tempName);
    }

    public async taskCancelOperation(task: ClipTask): Promise<void> {
        const srt = this.cacheService.get<SrtSentence>(task.srtKey);
        if (!srt) {
            return;
        }
        const metaData = this.mapToMetaData(task.videoPath, srt, task.indexInSrt);
        const key = metaData.key;
        await this.deleteFavoriteClip(key);
    }

    private mapToMetaData(videoPath: string, srt: SrtSentence, indexInSrt: number): MetaData {
        const srtLines: SrtLine[] = srt.sentences
            .map((sentence) => SrtUtil.toSrtLine(sentence));
        const clipContext = SrtUtil.srtAround(srtLines, indexInSrt, 5);
        const clipLine = SrtUtil.srtAt(srtLines, indexInSrt);
        const contentSrtStr = SrtUtil.toSrt(clipContext);
        const contextEnStr = clipContext.map((item) =>
            item.contentEn
        ).filter((item) => StrUtil.isNotBlank(item)).join('\n');
        const clipEnStr = clipLine.contentEn;

        return {
            key: hash(contentSrtStr),
            video_name: videoPath,
            created_at: Date.now(),
            start_time: clipContext[0].start ?? 0,
            end_time: clipContext[clipContext.length - 1].end ?? 0,
            srt_clip: clipEnStr,
            srt_clip_with_time: SrtUtil.toSrt([clipLine]),
            srt_context: contextEnStr,
            srt_context_with_time: contentSrtStr
        };
    }

    public async deleteFavoriteClip(key: string): Promise<void> {
        await db.delete(videoClip).where(eq(videoClip.key, key));
        await this.ossService.delete(key);
    }

    public async cancelAddClip(srtKey: string, indexInSrt: number): Promise<void> {
        const key = FavouriteClipsServiceImpl.mapKey(srtKey, indexInSrt);
        this.taskQueue.enqueueCancel(key);
    }
    async exist(srtKey: string, lineInSrt: number): Promise<boolean> {
        return (await this.exists(srtKey, [lineInSrt])).get(lineInSrt) ?? false;
    }
    async exists(srtKey: string, linesInSrt: number[]): Promise<Map<number, boolean>> {
        const srtSentence = this.cacheService.get<SrtSentence>(srtKey);
        if (!srtSentence) {
            throw new Error(ErrorConstants.CACHE_NOT_FOUND);
        }
        const srtLines: SrtLine[] = srtSentence.sentences
            .map((sentence) => SrtUtil.toSrtLine(sentence));
        const result = new Map<number, boolean>();
        for (const lineIndex of linesInSrt) {
            const info = this.taskQueue.info(FavouriteClipsServiceImpl.mapKey(srtKey, lineIndex));
            if (info) {
                result.set(lineIndex, info.operation === 'add');
                continue;
            }
            const context = SrtUtil.srtAround(srtLines, lineIndex, 5);
            const key = hash(SrtUtil.toSrt(context));
            const value = await this.clipInDb(key);
            result.set(lineIndex, value);
        }
        return result;
    }

    public async search({
                            keyword,
                            keywordRange,
                            tags,
                            tagsRelation,
                            date,
                            includeNoTag
                        }: ClipQuery): Promise<OssObject[]> {
        let where1 = and(sql`1=1`);
        let having1 = and(sql`1=1`);
        if (StrUtil.isNotBlank(keyword)) {
            if (keywordRange === 'context') {
                where1 = and(like(videoClip.srt_context, `%${keyword}%`));
            } else {
                where1 = and(like(videoClip.srt_clip, `%${keyword}%`));
            }
        }
        if (date?.from) {
            where1 = and(where1, gte(videoClip.created_at, TimeUtil.dateToUtc(date.from)));
        }
        if (date?.to) {
            where1 = and(where1, lte(videoClip.created_at, TimeUtil.dateToUtc(date.to)));
        }
        if (tags?.length) {
            where1 = and(where1, inArray(clipTagRelation.tag_id, tags));
            if (tagsRelation === 'and') {
                having1 = and(having1, eq(count(), tags.length));
            }
        }
        if (includeNoTag) {
            if (tagsRelation === 'or' && tags?.length) {
                having1 = or(having1, isNull(clipTagRelation.tag_id));
            } else {
                where1 = and(where1, isNull(clipTagRelation.tag_id));
            }
        }
        const lines: VideoClip[] = await db
            .select({
                key: videoClip.key,
                video_name: videoClip.video_name,
                srt_clip: videoClip.srt_clip,
                srt_context: videoClip.srt_context,
                created_at: videoClip.created_at,
                updated_at: videoClip.updated_at,
                count: count()
            }).from(videoClip)
            .leftJoin(clipTagRelation, eq(clipTagRelation.clip_key, videoClip.key))
            .leftJoin(tag, eq(clipTagRelation.tag_id, tag.id))
            .where(where1)
            .groupBy(videoClip.key)
            .having(having1)
            .orderBy(desc(videoClip.created_at))
            .limit(1000);
        return Promise.all(lines.map((line) => this.ossService.get(line.key)));
    }

    private async addToDb(metaData: MetaData) {
        await db.insert(videoClip).values({
            key: metaData.key,
            video_name: metaData.video_name,
            srt_clip: metaData.srt_clip,
            srt_context: metaData.srt_context,
            created_at: TimeUtil.timeUtc(),
            updated_at: TimeUtil.timeUtc()
        }).onConflictDoUpdate({
            target: [videoClip.key],
            set: {
                video_name: metaData.video_name,
                srt_clip: metaData.srt_clip,
                srt_context: metaData.srt_context,
                updated_at: TimeUtil.timeUtc()
            }
        });
    }

    private async clipInDb(key: string) {
        return (await db.select().from(videoClip).where(eq(videoClip.key, key)))
            .length > 0;
    }

    async queryClipTags(key: string): Promise<Tag[]> {
        const joinRes = await db.select().from(clipTagRelation)
            .leftJoin(tag, eq(clipTagRelation.tag_id, tag.id))
            .where(eq(clipTagRelation.clip_key, key));
        return joinRes.map((item) => item.dp_tag);
    }

    async addClipTag(key: string, tagId: number): Promise<void> {
        await db.insert(clipTagRelation).values({
            clip_key: key,
            tag_id: tagId,
            created_at: TimeUtil.timeUtc(),
            updated_at: TimeUtil.timeUtc()
        }).onConflictDoNothing();
    }

    async deleteClipTag(key: string, tagId: number): Promise<void> {
        await db.transaction(async (tx) => {
            await tx.delete(clipTagRelation).where(
                and(
                    eq(clipTagRelation.clip_key, key),
                    eq(clipTagRelation.tag_id, tagId)
                )
            );
            const r = await tx.select({ count: count() })
                .from(clipTagRelation)
                .where(eq(clipTagRelation.tag_id, tagId));
            if (r[0].count === 0) {
                await tx.delete(tag).where(eq(tag.id, tagId));
            }
        });
    }

    taskInfo(): number {
        return this.taskQueue.unfinishedLength();
    }

    @postConstruct()
    public postConstruct() {
        this.checkQueue().then();
    }
}
