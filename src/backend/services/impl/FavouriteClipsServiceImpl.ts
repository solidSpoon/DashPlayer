import hash from 'object-hash';
import path from 'path';
import db from '@/backend/db';
import { VideoClip, videoClip } from '@/backend/db/tables/videoClip';
import TimeUtil from '@/common/utils/TimeUtil';
import { and, count, desc, eq, gte, inArray, isNull, like, lte, or, sql } from 'drizzle-orm';
import fs from 'fs';
import ErrorConstants from '@/common/constants/error-constants';
import { inject, injectable, postConstruct } from 'inversify';
import TYPES from '@/backend/ioc/types';
import { tag, Tag } from '@/backend/db/tables/tag';
import { clipTagRelation } from '@/backend/db/tables/clipTagRelation';
import { ClipQuery } from '@/common/api/dto';
import StrUtil from '@/common/utils/str-util';

import { SrtSentence } from '@/common/types/SentenceC';
import { FavouriteClipsService } from '@/backend/services/FavouriteClipsService';
import dpLog from '@/backend/ioc/logger';
import CacheService from '@/backend/services/CacheService';
import LocationService, { LocationType } from '@/backend/services/LocationService';
import { ClipOssService } from '@/backend/services/OssService';
import TagService from '@/backend/services/TagService';
import CollUtil from '@/common/utils/CollUtil';
import FfmpegService from '@/backend/services/FfmpegService';
import { ClipMeta, ClipSrtLine, OssBaseMeta } from '@/common/types/clipMeta';
import SrtUtil, { SrtLine } from "@/common/utils/SrtUtil";

type ClipTask = {
    videoPath: string,
    srtKey: string,
    indexInSrt: number,
    clipKey: string,
    operation: 'add' | 'cancel'
};
@injectable()
export default class FavouriteClipsServiceImpl implements FavouriteClipsService {
    @inject(TYPES.ClipOssService)
    private clipOssService!: ClipOssService;

    @inject(TYPES.CacheService)
    private cacheService!: CacheService;

    @inject(TYPES.LocationService)
    private locationService!: LocationService;

    @inject(TYPES.TagService)
    private tagService!: TagService;

    @inject(TYPES.FfmpegService)
    private ffmpegService!: FfmpegService;

    /**
     * key: hash(srtContext)
     * @private
     */
    private taskQueue: Map<string, ClipTask> = new Map();


    public async addClip(videoPath: string, srtKey: string, indexInSrt: number): Promise<void> {
        const clipKey = this.mapToClipKey(srtKey, indexInSrt);
        this.taskQueue.set(clipKey, {
            videoPath,
            srtKey,
            indexInSrt,
            clipKey,
            operation: 'add'
        });
    }

    public async cancelAddClip(srtKey: string, indexInSrt: number): Promise<void> {
        const clipKey = this.mapToClipKey(srtKey, indexInSrt);
        this.taskQueue.set(clipKey, {
            videoPath: '',
            srtKey,
            indexInSrt,
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

        const exists = await db.select().from(videoClip).where(inArray(videoClip.key, newKeys));
        const existsKeys = exists.map((item) => item.key);
        const notExistKeys = newKeys.filter((key) => !existsKeys.includes(key));

        for (const k of notExistKeys) {
            const task = tempMapping.get(k);
            if (!task) {
                dpLog.error('task not found');
                continue;
            }
            if (task.operation === 'add') {
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
                await this.taskCancelOperation(task);
            }
            if (this.taskQueue.get(k) === task) {
                this.taskQueue.delete(k);
            }
        }
    }

    private async taskAddOperation(task: ClipTask): Promise<void> {
        const srt = this.cacheService.get('cache:srt', task.srtKey);
        if (!srt) {
            return;
        }
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
        await this.clipOssService.putClip(key, tempName, metaData);
        const meta = await this.clipOssService.get(key);
        if (!meta) {
            throw new Error('meta not found');
        }
        await this.addToDb(meta);
        fs.rmSync(tempName);
    }

    public async taskCancelOperation(task: ClipTask): Promise<void> {
        const srt = this.cacheService.get('cache:srt', task.srtKey);
        if (!srt) {
            return;
        }
        const key = this.mapToMetaKey(srt, task.indexInSrt);
        await this.deleteFavoriteClip(key);
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

    private mapToMetaData(videoPath: string, srt: SrtSentence, indexInSrt: number): ClipMeta {
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

    public async deleteFavoriteClip(key: string): Promise<void> {
        await db.delete(videoClip).where(eq(videoClip.key, key));
        await this.clipOssService.delete(key);
        const tagIds = await db.select({ tag_id: clipTagRelation.tag_id })
            .from(clipTagRelation)
            .leftJoin(videoClip, eq(clipTagRelation.clip_key, videoClip.key))
            .where(isNull(videoClip.key));
        for (const tagId of tagIds) {
            if (!tagId.tag_id) {
                continue;
            }
            await db.delete(tag).where(eq(tag.id, tagId.tag_id));
        }
    }

    async exists(srtKey: string, linesInSrt: number[]): Promise<Map<number, boolean>> {
        const srtSentence = this.cacheService.get('cache:srt', srtKey);
        if (!srtSentence) {
            throw new Error(ErrorConstants.CACHE_NOT_FOUND);
        }
        const result = new Map<number, boolean>();
        for (const lineIndex of linesInSrt) {
            const clipKey = this.mapToClipKey(srtKey, lineIndex);
            const info = this.taskQueue.get(clipKey);
            if (info) {
                result.set(lineIndex, info.operation === 'add');
                continue;
            }
            const value = await this.clipInDb(clipKey);
            result.set(lineIndex, value);
        }
        return result;
    }

    public async search(query?: ClipQuery): Promise<(OssBaseMeta & ClipMeta)[]> {
        const keyword = query?.keyword ?? '';
        const keywordRange = query?.keywordRange ?? 'clip';
        const tags = query?.tags ?? [];
        const tagsRelation = query?.tagsRelation ?? 'and';
        const date = query?.date;
        const includeNoTag = query?.includeNoTag ?? false;
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
        if (tags.length) {
            where1 = and(where1, inArray(clipTagRelation.tag_id, tags));
            if (tagsRelation === 'and') {
                having1 = and(having1, eq(count(), tags.length));
            }
        }
        if (includeNoTag) {
            if (tagsRelation === 'or' && tags.length) {
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
            .limit(5000);
        return Promise.all(lines
            .map((line) => this.clipOssService.get(line.key)))
            .then((res) => res.filter((item) => item !== null)) as Promise<(OssBaseMeta & ClipMeta)[]>;

    }

    private async addToDb(metaData: ClipMeta & OssBaseMeta) {
        const srtLines = metaData.clip_content ?? [];
        const srtContext = srtLines.filter(e => !e.isClip).map(e => e.contentEn).join('\n');
        const srtClip = srtLines.filter(e => e.isClip).map(e => e.contentEn).join('\n');
        await db.insert(videoClip).values({
            key: metaData.key,
            video_name: metaData.video_name,
            srt_clip: srtClip,
            srt_context: srtContext,
            created_at: TimeUtil.timeUtc(),
            updated_at: TimeUtil.timeUtc()
        }).onConflictDoUpdate({
            target: [videoClip.key],
            set: {
                video_name: metaData.video_name,
                srt_clip: srtClip,
                srt_context: srtContext,
                updated_at: TimeUtil.timeUtc()
            }
        });
        const tagNames = CollUtil.emptyIfNull(metaData.tags);
        for (const tagName of tagNames) {
            const tag = await this.tagService.addTag(tagName);
            await this.addClipTag(metaData.key, tag.id);
        }
    }

    private async clipInDb(key: string) {
        return (await db.select().from(videoClip).where(eq(videoClip.key, key)))
            .length > 0;
    }

    async queryClipTags(key: string): Promise<Tag[]> {
        const joinRes = await db.select().from(clipTagRelation)
            .leftJoin(tag, eq(clipTagRelation.tag_id, tag.id))
            .where(eq(clipTagRelation.clip_key, key));
        return joinRes
            .map((item) => item.dp_tag)
            .filter((item): item is Tag => item !== null);
    }


    async addClipTag(key: string, tagId: number): Promise<void> {
        await db.insert(clipTagRelation).values({
            clip_key: key,
            tag_id: tagId,
            created_at: TimeUtil.timeUtc(),
            updated_at: TimeUtil.timeUtc()
        }).onConflictDoNothing();
        await this.syncTagToOss(key);
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
        await this.syncTagToOss(key);
    }

    async renameTag(tagId: number, newName: string): Promise<void> {
        await this.tagService.updateTag(tagId, newName);
        // 查出来所有带有这个tag的clip
        const clips = await db.select().from(clipTagRelation)
            .leftJoin(videoClip, eq(clipTagRelation.clip_key, videoClip.key))
            .where(eq(clipTagRelation.tag_id, tagId));
        for (const clip of clips) {
            if (!clip.dp_video_clip) {
                continue;
            }
            await this.syncTagToOss(clip.dp_video_clip.key);
        }
    }

    taskInfo(): number {
        return this.taskQueue.size;
    }

    private async syncTagToOss(key: string): Promise<void> {
        const tags = await this.queryClipTags(key);
        const tagNames = tags.map((tag) => tag.name);
        await this.clipOssService.updateTags(key, tagNames);
    }

    /**
     * 清除数据库，重新从oss同步
     */
    async syncFromOss() {
        const keys = await this.clipOssService.list();
        await db.delete(videoClip).where(sql`1=1`);
        await db.delete(clipTagRelation).where(sql`1=1`);
        await db.delete(tag).where(sql`1=1`);
        for (const key of keys) {
            const clip = await this.clipOssService.get(key);
            if (!clip) {
                continue;
            }
            await this.addToDb(clip);
        }
    }

    @postConstruct()
    public postConstruct() {
        const func = async () => {
            // dpLog.info('FavouriteClipsServiceImpl task start');
            await this.checkQueue();
            setTimeout(func, 1000);
        };
        func().catch((e) => {
            dpLog.error(e);
        });
    }

}
