import registerRoute from '@/backend/adapters/ipc/registerRoute';
import { FolderVideos } from '@/common/types/tonvert-type';
import Controller from '@/backend/interfaces/controller';
import { inject, injectable } from 'inversify';
import TYPES from '@/backend/ioc/types';
import DpTaskService from '@/backend/application/services/DpTaskService';
import ConvertService from '@/backend/application/services/ConvertService';
import FfmpegService from '@/backend/application/services/FfmpegService';
import path from 'path';
import fs from 'fs';
import { VideoInfo } from '@/common/types/video-info';

@injectable()
export default class ConvertController implements Controller {
    @inject(TYPES.DpTaskService)
    private dpTaskService!: DpTaskService;

    @inject(TYPES.ConvertService)
    private convertService!: ConvertService;

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
        const parsed = path.parse(filePath);
        if (parsed.base.endsWith('.html5.mp4')) {
            return filePath;
        }
        const baseName = parsed.name.endsWith('.html5') ? parsed.name.slice(0, -'.html5'.length) : parsed.name;
        const html5Path = path.join(parsed.dir, `${baseName}.html5.mp4`);
        return fs.existsSync(html5Path) ? html5Path : null;
    }

    registerRoutes(): void {
        registerRoute('convert/to-mp4', (p) => this.toMp4(p));
        registerRoute('convert/from-folder', (p) => this.fromFolder(p));
        registerRoute('convert/video-length', (p) => this.videoLength(p));
        registerRoute('convert/video-info', (p) => this.videoInfo(p));
        registerRoute('convert/suggest-html5-video', (p) => this.suggestHtml5Video(p));
    }
}
