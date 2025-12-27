import registerRoute from '@/backend/adapters/ipc/registerRoute';
import { FolderVideos } from '@/common/types/tonvert-type';
import Controller from '@/backend/interfaces/controller';
import { inject, injectable } from 'inversify';
import TYPES from '@/backend/ioc/types';
import DpTaskService from '@/backend/application/services/DpTaskService';
import FfmpegService from '@/backend/application/services/FfmpegService';
import { VideoInfo } from '@/common/types/video-info';
import ConvertServiceImpl from '@/backend/application/services/impl/ConvertServiceImpl';

@injectable()
export default class ConvertController implements Controller {
    @inject(TYPES.DpTaskService)
    private dpTaskService!: DpTaskService;

    @inject(TYPES.ConvertService)
    private convertService!: ConvertServiceImpl;

    @inject(TYPES.FfmpegService)
    private ffmpegService!: FfmpegService;

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

    public async videoInfo(filePath: string): Promise<VideoInfo> {
        return this.ffmpegService.getVideoInfo(filePath);
    }

    public async suggestHtml5Video(filePath: string): Promise<string | null> {
        return this.convertService.suggestHtml5Video(filePath);
    }

    registerRoutes(): void {
        registerRoute('convert/to-mp4', (p) => this.toMp4(p));
        registerRoute('convert/from-folder', (p) => this.fromFolder(p));
        registerRoute('convert/video-length', (p) => this.videoLength(p));
        registerRoute('convert/video-info', (p) => this.videoInfo(p));
        registerRoute('convert/suggest-html5-video', (p) => this.suggestHtml5Video(p));
    }
}
