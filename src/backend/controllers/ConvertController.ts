import registerRoute from '@/common/api/register';
import { FolderVideos } from '@/common/types/tonvert-type';
import Controller from '@/backend/interfaces/controller';
import { inject, injectable } from 'inversify';
import TYPES from '@/backend/ioc/types';
import DpTaskService from '@/backend/services/DpTaskService';
import ConvertService from '@/backend/services/ConvertService';
import FfmpegService from '@/backend/services/FfmpegService';

@injectable()
export default class ConvertController implements Controller {
    @inject(TYPES.DpTaskService)
    private dpTaskService: DpTaskService;

    @inject(TYPES.ConvertService)
    private convertService: ConvertService;

    @inject(TYPES.FfmpegService)
    private ffmpegService: FfmpegService;

    public async toMp4(file: string): Promise<number> {
        const taskId = await this.dpTaskService.create();
        this.convertService.toMp4(taskId, file).then();
        return taskId;
    }

    public async fromFolder(folders: string[]): Promise<FolderVideos[]> {
        return this.convertService.fromFolder(folders);
    }

    public async videoLength(filePath: string): Promise<number> {
        return this.ffmpegService.duration(filePath);
    }

    registerRoutes(): void {
        registerRoute('convert/to-mp4', (p) => this.toMp4(p));
        registerRoute('convert/from-folder', (p) => this.fromFolder(p));
        registerRoute('convert/video-length', (p) => this.videoLength(p));
    }
}
