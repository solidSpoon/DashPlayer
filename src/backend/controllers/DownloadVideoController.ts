import Controller from "@/backend/interfaces/controller";
import registerRoute from "@/common/api/register";
import DlVideoService from "@/backend/services/DlVideoService";
import { app } from 'electron';
import DpTaskService from '@/backend/services/DpTaskService';

export default class DownloadVideoController implements Controller {
    async downloadVideo({url}: {
        url: string
    }): Promise<number> {
        // 系统下载文件夹
        const taskId = await DpTaskService.create();
        const downloadFolder = app.getPath('downloads');
        DlVideoService.dlVideo(taskId, url, downloadFolder).then();
        return taskId;
    }
    async fileName({url}: {
        url: string
    }): Promise<number> {
        // 系统下载文件夹
        const taskId = await DpTaskService.create();
        DlVideoService.dlVideoFileName(taskId, url).then();
        return taskId;
    }

    registerRoutes() {
        registerRoute('download-video/url', this.downloadVideo);
        registerRoute('download-video/file-name', this.fileName);
    }
}
