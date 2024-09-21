import registerRoute from '@/common/api/register';
import { DlVideoService } from '@/backend/services/DlVideoServiceImpl';
import DpTaskService from '@/backend/services/DpTaskService';
import { inject, injectable } from 'inversify';
import Controller from '@/backend/interfaces/controller';
import TYPES from '@/backend/ioc/types';
import LocationService, { LocationType } from '@/backend/services/LocationService';

@injectable()
export default class DownloadVideoController implements Controller {
    @inject(TYPES.DlVideo)
    private dlVideoService: DlVideoService;


    @inject(TYPES.LocationService)
    private locationService: LocationService;

    async downloadVideo({ url }: {
        url: string
    }): Promise<number> {
        // 系统下载文件夹
        const taskId = await DpTaskService.create();
        const downloadFolder = this.locationService.getStoragePath(LocationType.VIDEOS);
        this.dlVideoService.dlVideo(taskId, url, downloadFolder).then();
        return taskId;
    }

    registerRoutes(): void {
        registerRoute('download-video/url', this.downloadVideo.bind(this));
    }
}
