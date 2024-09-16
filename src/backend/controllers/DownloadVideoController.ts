import registerRoute from '@/common/api/register';
import { DlVideoService } from '@/backend/services/DlVideoServiceImpl';
import DpTaskService from '@/backend/services/DpTaskService';
import LocationService, { LocationType } from '@/backend/services/LocationService';
import { inject, injectable } from 'inversify';
import Controller from '@/backend/interfaces/controller';
import TYPES from '@/backend/ioc/types';

@injectable()
export default class DownloadVideoController implements Controller {
    @inject(TYPES.DlVideo) private dlVideoService: DlVideoService;
    async downloadVideo({url}: {
        url: string
    }): Promise<number> {
        // 系统下载文件夹
        const taskId = await DpTaskService.create();
        const downloadFolder = LocationService.getStoragePath(LocationType.VIDEOS);
        this.dlVideoService.dlVideo(taskId, url, downloadFolder).then();
        return taskId;
    }

    registerRoutes(): void {
        registerRoute('download-video/url', this.downloadVideo.bind(this));
    }
}
