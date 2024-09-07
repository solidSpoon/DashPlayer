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
import { desc, eq, like, or } from 'drizzle-orm';
import LocationService, { LocationType } from '@/backend/services/LocationService';
import fs from 'fs';
import { DpTaskState } from '@/backend/db/tables/dpTask';
import DpTaskService from '@/backend/services/DpTaskService';
import ErrorConstants from '@/common/constants/error-constants';

export default class FavoriteClipsService {
    private static queue: {
        videoPath: string,
        key: string,
        srtClip: SrtLine[],
        taskId: number | null,
        state: DpTaskState
    }[] = [];

    public static async addFavoriteClipAsync(videoPath: string, srtClip: SrtLine[]): Promise<number> {
        const key = hash(SrtUtil.toSrt(srtClip));
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
            taskId,
            state: DpTaskState.INIT
        });
        return taskId;
    }

    /**
     * 定时任务
     */
    public static async checkQueue() {
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
                await this.addFavoriteClip(item.videoPath, item.srtClip);
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

    static {
        const func =async () => {
            await this.checkQueue();
            setTimeout(func, 3000);
        }
        func().then();
    }

    private static async addFavoriteClip(videoPath: string, srtClip: SrtLine[]): Promise<void> {
        const metaData: MetaData = this.extractMetaData(videoPath, srtClip);
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
        await LocalOssService.put(key, tempName, metaData);
        await this.addToDb(metaData);
        fs.rmSync(tempName);
    }

    public static async deleteFavoriteClip(key: string): Promise<void> {
        await db.delete(videoClip).where(eq(videoClip.key, key));
        await LocalOssService.delete(key);
    }

    public static async search(keyword: string): Promise<OssObject[]> {
        const lines: VideoClip[] = await db
            .select()
            .from(videoClip)
            .where(or(
                like(videoClip.video_name, `%${keyword}%`),
                like(videoClip.srt_str, `%${keyword}%`)
            ))
            .orderBy(desc(videoClip.updated_at));
        return Promise.all(lines.map((line) => LocalOssService.get(line.key)));
    }

    private static async addToDb(metaData: MetaData) {
        await db.insert(videoClip).values({
            key: metaData.key,
            video_name: metaData.video_name,
            srt_str: metaData.srt_str,
            created_at: TimeUtil.timeUtc(),
            updated_at: TimeUtil.timeUtc()
        }).onConflictDoUpdate({
            target: [videoClip.key],
            set: {
                video_name: metaData.video_name,
                srt_str: metaData.srt_str,
                updated_at: TimeUtil.timeUtc()
            }
        });
    }

    private static extractMetaData(videoName: string, srtClip: SrtLine[]): MetaData {

        const srtStr = SrtUtil.toSrt(srtClip);
        const strClip = srtClip.map((item) =>
            [item.contentZh, item.contentEn]
                .filter((item) => Util.strNotBlank(item)).join('\n')
        ).join('\n');

        return {
            key: hash(srtStr),
            video_name: videoName,
            created_at: Date.now(),
            start_time: srtClip[0].start ?? 0,
            end_time: srtClip[srtClip.length - 1].end ?? 0,
            srt_clip: strClip,
            srt_str: srtStr
        };
    }

    private static async isFavoriteClipExist(key: string) {
        return (await db.select().from(videoClip).where(eq(videoClip.key, key)))
            .length > 0;
    }
}
