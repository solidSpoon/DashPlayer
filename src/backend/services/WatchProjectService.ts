import { WatchProjectVideo } from '@/backend/db/tables/watchProjectVideos';
import { WatchProjectListVO, WatchProjectVO } from '@/common/types/watch-project';


export default interface WatchProjectService {
    list(): Promise<WatchProjectListVO[]>;

    detail(id: number): Promise<WatchProjectVO>;

    delete(id: number): Promise<void>;

    createFromFiles(filePath: string[]): Promise<number>;

    createFromDirectory(dirPath: string): Promise<number>;

    attachSrt(videoPath: string, srtPath: string): Promise<void>;

    updateProgress(videoId: number, currentTime: number, duration: number): Promise<void>;

    play(videoId: number): Promise<void>;

    videoDetail(videoId: number): Promise<WatchProjectVideo | undefined>;

    videoDetailByPid(projId: number): Promise<WatchProjectVideo>;

    detailByVid(vid: number): Promise<WatchProjectVO>;

    tryCreateFromDownload(fileName: string): Promise<number>;

    analyseFolder(path: string): { supported: number, unsupported: number };
}
