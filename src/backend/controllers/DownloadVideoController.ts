import registerRoute from '@/common/api/register';
import { inject, injectable } from 'inversify';
import Controller from '@/backend/interfaces/controller';
import TYPES from '@/backend/ioc/types';
import LocationService, { LocationType } from '@/backend/services/LocationService';
import DpTaskService from '@/backend/services/DpTaskService';
import DlVideoService from '@/backend/services/DlVideoService';

@injectable()
export default class DownloadVideoController implements Controller {
    @inject(TYPES.DlVideo)
    private dlVideoService!: DlVideoService;


    @inject(TYPES.LocationService)
    private locationService!: LocationService;

    @inject(TYPES.DpTaskService)
    private dpTaskService!: DpTaskService;

    async downloadVideo({ url }: {
        url: string
    }): Promise<number> {
        // 系统下载文件夹
        const taskId = await this.dpTaskService.create();
        const downloadFolder = this.locationService.getDetailLibraryPath(LocationType.VIDEOS);
        this.dlVideoService.dlVideo(taskId, url, downloadFolder).then();
        return taskId;
    }

    registerRoutes(): void {
        registerRoute('download-video/url', (p) => this.downloadVideo(p));
    }
}
