import fs from 'fs';
import ProgressCache from '../ServerLib/ProgressCache';
import WatchProjectService, { WatchProjectVO } from '../../db/service/WatchProjectService';
import { WatchProjectVideo } from '../../db/entity/WatchProjectVideo';

export interface ProgressParam {
    fileName: string;
    /**
     * 总时长
     */
    total: number;
    /**
     * 当前进度
     */
    progress: number;
    /**
     * 文件位置
     */
    filePath: string | undefined;

    /**
     * 字幕文件位置
     */
    subtitlePath: string | undefined;
}


/**
 * 最近播放
 */
export async function queryRecentPlay(size: number): Promise<ProgressParam[]> {
    const result = await ProgressCache.queryRecentPlay(size);
    return result
        .filter((e) => e.filePath)
        .filter((e) => fs.existsSync(e.filePath ?? ''))
        .map((item) => {
            return {
                fileName: item.fileName,
                filePath: item.filePath,
                subtitlePath: item.subtitlePath,
                progress: item.progress ?? 0,
                total: item.total ?? 0
            };
        });
}

export async function recentWatch(): Promise<WatchProjectVO[]> {
    return WatchProjectService.listRecent();
}

export async function queryVideoProgress(
    id: number
): Promise<WatchProjectVideo> {
    return WatchProjectService.queryVideoProgress(id);
}


export async function updateVideoProgress(
    video: WatchProjectVideo
): Promise<void> {
    await WatchProjectService.updateVideoProgress(video);
}
