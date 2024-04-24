import Controller from '@/backend/interfaces/controller';
import registerRoute from '@/common/api/register';
import {WatchProject} from '@/backend/db/tables/watchProjects';
import WatchProjectNewService, {WatchProjectVO} from '@/backend/services/WatchProjectNewService';
import {WatchProjectVideo} from '@/backend/db/tables/watchProjectVideos';
import path from 'path';

export default class WatchProjectController implements Controller{

    public async updateProgress({ videoId, currentTime,duration }: {videoId:number, currentTime: number, duration: number}): Promise<void> {
        return WatchProjectNewService.updateProgress(videoId, currentTime, duration);
    }

    public async play(videoId: number): Promise<void> {
        return WatchProjectNewService.play(videoId);
    }
    public async videoDetail(videoId: number): Promise<WatchProjectVideo> {
        return WatchProjectNewService.videoDetail(videoId);
    }
    public async videoDetailByPid(projId: number): Promise<WatchProjectVideo> {
        return await WatchProjectNewService.videoDetailByPid(projId);
    }
    public async createFromFolder(path: string): Promise<number> {
        return WatchProjectNewService.createFromDirectory(path);
    }
    public async createFromFiles(files: string[]): Promise<number> {
        return WatchProjectNewService.createFromFiles(files);
    }
    public async attachSrt({videoPath, srtPath}:{videoPath: string, srtPath: string|'same'}): Promise<void> {
        if (srtPath === 'same') {
            srtPath = path.join(path.dirname(videoPath), path.basename(videoPath, path.extname(videoPath)) + '.srt');
        }
        await WatchProjectNewService.attachSrt(videoPath, srtPath);
    }

    public async delete(id: number): Promise<void> {
        return WatchProjectNewService.delete(id);
    }

    public async detail(id: number): Promise<WatchProjectVO> {
        return WatchProjectNewService.detail(id);
    }
    public async detailByVid(vid: number): Promise<WatchProjectVO> {
        return WatchProjectNewService.detailByVid(vid);
    }

    public async list(): Promise<WatchProject[]> {
        return WatchProjectNewService.list();
    }

    registerRoutes(): void {
        registerRoute('watch-project/progress/update', this.updateProgress);
        registerRoute('watch-project/video/play', this.play);
        registerRoute('watch-project/video/detail', this.videoDetail);
        registerRoute('watch-project/video/detail/by-pid', this.videoDetailByPid);
        registerRoute('watch-project/create/from-folder', this.createFromFolder);
        registerRoute('watch-project/create/from-files', this.createFromFiles);
        registerRoute('watch-project/delete', this.delete);
        registerRoute('watch-project/detail', this.detail);
        registerRoute('watch-project/detail/by-vid', this.detailByVid);
        registerRoute('watch-project/list', this.list);
        registerRoute('watch-project/attach-srt', this.attachSrt);
    }
}
