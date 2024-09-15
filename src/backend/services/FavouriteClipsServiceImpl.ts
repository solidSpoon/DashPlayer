import LocalOssService from '@/backend/services/LocalOssService';
import SrtUtil, { SrtLine } from '@/common/utils/SrtUtil';
import Util from '@/common/utils/Util';
import hash from 'object-hash';
import FfmpegService from '@/backend/services/FfmpegService';
import path from 'path';
import { MetaData, OssObject } from '@/common/types/OssObject';
import db from '@/backend/db';
import { VideoClip, videoClip } from '@/backend/db/tables/videoClip';
import TimeUtil from '@/common/utils/TimeUtil';
import { and, count, desc, eq, ExtractTablesWithRelations, like, or } from 'drizzle-orm';
import LocationService, { LocationType } from '@/backend/services/LocationService';
import fs from 'fs';
import { DpTaskState } from '@/backend/db/tables/dpTask';
import DpTaskService from '@/backend/services/DpTaskService';
import ErrorConstants from '@/common/constants/error-constants';
import { inject, injectable } from 'inversify';
import TYPES from '@/backend/ioc/types';
import { tag, Tag } from '@/backend/db/tables/tag';
import { clipTagRelation } from '@/backend/db/tables/clipTagRelation';
import { TagService } from '@/backend/services/TagService';
import { SQLiteTransaction } from 'drizzle-orm/sqlite-core';
import Database from 'better-sqlite3';

export interface FavouriteClipsService {
    addFavoriteClipAsync(videoPath: string, srtClip: SrtLine, srtContext: SrtLine[]): Promise<number>;

    deleteFavoriteClip(key: string): Promise<void>;

    queryClipTags(key: string): Promise<Tag[]>;

    addClipTag(key: string, tagId: number): Promise<void>;

    deleteClipTag(key: string, tagId: number): Promise<void>;

    search(keyword: string): Promise<OssObject[]>;

    checkQueue(): Promise<void>;
}

@injectable()
export default class FavouriteClipsServiceImpl implements FavouriteClipsService {
    @inject(TYPES.LocalOss) private ossService: LocalOssService;
    @inject(TYPES.TagService) private tagService: TagService;

    private queue: {
        videoPath: string,
        key: string,
        srtClip: SrtLine,
        srtContext: SrtLine[],
        taskId: number | null,
        state: DpTaskState
    }[] = [];

    public async addFavoriteClipAsync(videoPath: string, srtClip: SrtLine, srtContext: SrtLine[]): Promise<number> {
        const key = hash(SrtUtil.toSrt(srtContext));
        let exist = await this.isFavoriteClipExist(key);
        if (exist) {
            throw new Error(ErrorConstants.CLIP_EXISTS);
        }
        exist = this.queue.find((item) => item.key === key) !== undefined;
        if (exist) {
            throw new Error(ErrorConstants.CLIP_EXISTS);
        }
        const taskId = await DpTaskService.create();
        this.queue.push({
            videoPath,
            key: key,
            srtClip,
            srtContext,
            taskId,
            state: DpTaskState.INIT
        });
        return taskId;
    }

    /**
     * 定时任务
     */
    public async checkQueue() {
        if (this.queue.length === 0) {
            return;
        }
        const item = this.queue[0];
        if (item.state === DpTaskState.INIT) {
            console.log('start task', item.taskId, item.videoPath);
            item.state = DpTaskState.IN_PROGRESS;
            DpTaskService.update({
                id: item.taskId,
                status: item.state
            });
            try {
                await this.addFavoriteClip(item.videoPath, item.srtClip, item.srtContext);
                item.state = DpTaskState.DONE;
            } catch (error) {
                item.state = DpTaskState.FAILED;
            } finally {
                DpTaskService.update({
                    id: item.taskId,
                    status: item.state
                });
            }
        }
        this.queue.shift();
    }


    private async addFavoriteClip(videoPath: string, srtClip: SrtLine, srtContext: SrtLine[]): Promise<void> {
        const metaData: MetaData = FavouriteClipsServiceImpl.extractMetaData(videoPath, srtClip, srtContext);
        const key = metaData.key;
        const folder = LocationService.getStoragePath(LocationType.TEMP);
        if (!fs.existsSync(folder)) {
            fs.mkdirSync(folder, { recursive: true });
        }
        const tempName = path.join(folder, key + '.mp4');
        if (await this.isFavoriteClipExist(key)) {
            return;
        }
        await FfmpegService.trimVideo(videoPath, metaData.start_time, metaData.end_time, tempName);
        await this.ossService.put(key, tempName, metaData);
        await this.addToDb(metaData);
        fs.rmSync(tempName);
    }

    public async deleteFavoriteClip(key: string): Promise<void> {
        await db.delete(videoClip).where(eq(videoClip.key, key));
        await this.ossService.delete(key);
    }

    public async search(keyword: string): Promise<OssObject[]> {
        const lines: VideoClip[] = await db
            .select()
            .from(videoClip)
            .where(or(
                like(videoClip.video_name, `%${keyword}%`),
                like(videoClip.srt_clip, `%${keyword}%`)
            ))
            .orderBy(desc(videoClip.updated_at));
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

    private static extractMetaData(videoName: string,
                                   srtClip: SrtLine,
                                   srtContext: SrtLine[]
    ): MetaData {

        const srtStr = SrtUtil.toSrt(srtContext);
        const strContextStr = srtContext.map((item) =>
            item.contentEn
        ).filter((item) => Util.strNotBlank(item)).join('\n');
        const srtClipStr = srtClip.contentEn;

        return {
            key: hash(srtStr),
            video_name: videoName,
            created_at: Date.now(),
            start_time: srtContext[0].start ?? 0,
            end_time: srtContext[srtContext.length - 1].end ?? 0,
            srt_clip: srtClipStr,
            srt_clip_with_time: SrtUtil.toSrt([srtClip]),
            srt_context: strContextStr,
            srt_context_with_time: srtStr
        };
    }

    private async isFavoriteClipExist(key: string) {
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
}
