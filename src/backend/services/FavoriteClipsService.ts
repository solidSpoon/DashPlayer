import LocalOssService from '@/backend/services/LocalOssService';
import SrtUtil, { SrtLine } from '@/common/utils/SrtUtil';
import Util from '@/common/utils/Util';
import hash from 'object-hash';
import { app } from 'electron';
import FfmpegService from '@/backend/services/FfmpegService';
import path from 'path';
import { MetaData, OssObject } from '@/common/types/OssObject';
import db from '@/backend/db';
import { VideoClip, videoClip } from '@/backend/db/tables/videoClip';
import TimeUtil from '@/common/utils/TimeUtil';
import { desc, eq, like, or } from 'drizzle-orm';

export default class FavoriteClipsService {

    public static async addFavoriteClip(videoPath: string, srtClip: SrtLine[]): Promise<void> {
        const metaData: MetaData = this.extractMetaData(videoPath, srtClip);
        const key = metaData.key;
        const folder = app.getPath('downloads');
        const tempName = path.join(folder, key + '.mp4');
        if (await this.isFavoriteClipExist(key)) {
            return;
        }
        await FfmpegService.trimVideo(videoPath, metaData.start_time, metaData.end_time, tempName);
        await LocalOssService.put(key, tempName, metaData);
        await this.addToDb(metaData);
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
            .orderBy(desc(videoClip.updated_at))
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
        })
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
