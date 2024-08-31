import LocalOssService, { MetaData } from '@/backend/services/LocalOssService';
import SrtUtil, { SrtLine } from '@/common/utils/SrtUtil';
import Util from '@/common/utils/Util';
import hash from 'object-hash';
import { app } from 'electron';
import FfmpegService from '@/backend/services/FfmpegService';
import path from 'path';

export default class FavoriteClipsService {

    public static async addFavoriteClip(videoPath: string, srtClip: SrtLine[]): Promise<void> {
        const metaData: MetaData = this.extractMetaData(videoPath, srtClip);
        const key = metaData.key;
        const folder = app.getPath('downloads');
        const tempName = path.join(folder, key + '.mp4');
        await FfmpegService.trimVideo(videoPath, metaData.start_time, metaData.end_time, tempName);
        await LocalOssService.put(key, tempName, metaData);
    }

    private static extractMetaData(videoName:string, srtClip: SrtLine[]): MetaData {

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

}
