import WatchProjectService, { WatchProjectVO } from '../../db/service/WatchProjectService';
import { WatchProjectVideo } from '../../db/entity/WatchProjectVideo';

export async function recentWatch(): Promise<WatchProjectVO[]> {
    return WatchProjectService.listRecent();
}

export async function reloadRecentFromDisk(): Promise<WatchProjectVO[]> {
   return WatchProjectService.reloadRecentFromDisk();
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
