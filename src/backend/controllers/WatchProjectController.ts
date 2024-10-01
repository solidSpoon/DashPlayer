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
        registerRoute('watch-project/progress/update', this.updateProgress.bind(this));
        registerRoute('watch-project/video/play', this.play.bind(this));
        registerRoute('watch-project/video/detail', this.videoDetail.bind(this));
        registerRoute('watch-project/video/detail/by-pid', this.videoDetailByPid.bind(this));
        registerRoute('watch-project/create/from-folder', this.createFromFolder.bind(this));
        registerRoute('watch-project/create/from-files', this.createFromFiles.bind(this));
        registerRoute('watch-project/analyse-folder', this.analyseFolder.bind(this));
        registerRoute('watch-project/create/from-download', this.tryCreateFromDownload.bind(this));
        registerRoute('watch-project/delete', this.delete.bind(this));
        registerRoute('watch-project/detail', this.detail.bind(this));
        registerRoute('watch-project/detail/by-vid', this.detailByVid.bind(this));
        registerRoute('watch-project/list', this.list.bind(this));
        registerRoute('watch-project/attach-srt', this.attachSrt.bind(this));
    }
}
