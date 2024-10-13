import registerRoute from '@/common/api/register';
import WatchProjectService from '@/backend/services/WatchProjectService';
import { WatchProjectVideo } from '@/backend/db/tables/watchProjectVideos';
import path from 'path';
import { inject, injectable } from 'inversify';
import TYPES from '@/backend/ioc/types';
import Controller from '@/backend/interfaces/controller';
import { WatchProjectListVO, WatchProjectVO } from '@/common/types/watch-project';

@injectable()
export default class WatchProjectController implements Controller {
    @inject(TYPES.WatchProject) private watchProjectService!: WatchProjectService;

    public async updateProgress({ videoId, currentTime, duration }: {
        videoId: number,
        currentTime: number,
        duration: number
    }): Promise<void> {
        return this.watchProjectService.updateProgress(videoId, currentTime, duration);
    }

    public async play(videoId: number): Promise<void> {
        return this.watchProjectService.play(videoId);
    }

    public async videoDetail(videoId: number): Promise<WatchProjectVideo | undefined> {
        return this.watchProjectService.videoDetail(videoId);
    }

    public async videoDetailByPid(projId: number): Promise<WatchProjectVideo> {
        return await this.watchProjectService.videoDetailByPid(projId);
    }

    public async createFromFolder(path: string): Promise<number> {
        return this.watchProjectService.createFromDirectory(path);
    }

    public async createFromFiles(files: string[]): Promise<number> {
        return this.watchProjectService.createFromFiles(files);
    }

    public async analyseFolder(path: string): Promise<{ supported: number, unsupported: number }> {
        return this.watchProjectService.analyseFolder(path);
    }

    public async tryCreateFromDownload(fileName: string): Promise<number> {
        return this.watchProjectService.tryCreateFromDownload(fileName);
    }

    public async attachSrt({ videoPath, srtPath }: { videoPath: string, srtPath: string | 'same' }): Promise<void> {
        if (srtPath === 'same') {
            srtPath = path.join(path.dirname(videoPath), path.basename(videoPath, path.extname(videoPath)) + '.srt');
        }
        await this.watchProjectService.attachSrt(videoPath, srtPath);
    }

    public async delete(id: number): Promise<void> {
        return this.watchProjectService.delete(id);
    }

    public async detail(id: number): Promise<WatchProjectVO> {
        return this.watchProjectService.detail(id);
    }

    public async detailByVid(vid: number): Promise<WatchProjectVO> {
        return this.watchProjectService.detailByVid(vid);
    }

    public async list(): Promise<WatchProjectListVO[]> {
        return this.watchProjectService.list();
    }

    registerRoutes(): void {
        registerRoute('watch-project/progress/update', (p) => this.updateProgress(p));
        registerRoute('watch-project/video/play', (p) => this.play(p));
        registerRoute('watch-project/video/detail', (p) => this.videoDetail(p));
        registerRoute('watch-project/video/detail/by-pid', (p) => this.videoDetailByPid(p));
        registerRoute('watch-project/create/from-folder', (p) => this.createFromFolder(p));
        registerRoute('watch-project/create/from-files', (p) => this.createFromFiles(p));
        registerRoute('watch-project/analyse-folder', (p) => this.analyseFolder(p));
        registerRoute('watch-project/create/from-download', (p) => this.tryCreateFromDownload(p));
        registerRoute('watch-project/delete', (p) => this.delete(p));
        registerRoute('watch-project/detail', (p) => this.detail(p));
        registerRoute('watch-project/detail/by-vid', (p) => this.detailByVid(p));
        registerRoute('watch-project/list', (p) => this.list());
        registerRoute('watch-project/attach-srt', (p) => this.attachSrt(p));
    }
}
