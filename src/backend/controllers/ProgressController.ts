import WatchProjectService, {
    WatchProjectVO,
} from '@/backend/services/WatchProjectService';
import { WatchProjectVideo } from '@/backend/db/tables/watchProjectVideos';

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
