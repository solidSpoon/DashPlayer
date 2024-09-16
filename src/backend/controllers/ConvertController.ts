import registerRoute from '@/common/api/register';
import DpTaskService from '@/backend/services/DpTaskService';
import ConvertService from '@/backend/services/ConvertService';
import { FolderVideos } from '@/common/types/tonvert-type';
import FfmpegService from '@/backend/services/FfmpegService';
import Controller from '@/backend/interfaces/controller';
import { injectable } from 'inversify';

@injectable()
export default class ConvertController implements Controller {
    public async toMp4(file: string): Promise<number> {
        const taskId = await DpTaskService.create();
        ConvertService.toMp4(taskId, file).then();
        return taskId;
    }

    public async fromFolder(folders: string[]): Promise<FolderVideos[]> {
        return ConvertService.fromFolder(folders);
    }

    public async videoLength(filePath: string): Promise<number> {
        return FfmpegService.duration(filePath);
    }

    registerRoutes(): void {
        registerRoute('convert/to-mp4', (p) => this.toMp4(p));
        registerRoute('convert/from-folder', (p) => this.fromFolder(p));
        registerRoute('convert/video-length', (p) => this.videoLength(p));
    }
}
