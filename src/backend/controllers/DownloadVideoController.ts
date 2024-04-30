import Controller from "@/backend/interfaces/controller";
import registerRoute from "@/common/api/register";
import DlVideoService from "@/backend/services/DlVideoService";
import {app} from "electron";

export default class DownloadVideoController implements Controller {
    async downloadVideo({url}: {
        url: string
    }): Promise<void> {
        // 系统下载文件夹
        const downloadFolder = app.getPath('downloads');
        DlVideoService.dlVideo(url, downloadFolder);
    }

    registerRoutes() {
        registerRoute('download-video/url', this.downloadVideo);
    }
}
