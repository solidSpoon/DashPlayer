import {ChapterParseResult} from '@/common/types/chapter-result';
import registerRoute from '@/common/api/register';
import FfmpegServiceImpl from '@/backend/services/impl/FfmpegServiceImpl';
import { inject, injectable } from 'inversify';
import Controller from '@/backend/interfaces/controller';
import TYPES from '@/backend/ioc/types';
import SplitVideoService from '@/backend/services/SplitVideoService';
import MediaService from '../services/MediaService';

@injectable()
export default class MediaController implements Controller {

    @inject(TYPES.SplitVideoService)
    private splitVideoService!: SplitVideoService;

    @inject(TYPES.FfmpegService)
    private ffmpegService!: FfmpegServiceImpl;
    @inject(TYPES.MediaService)
    private mediaService!: MediaService;

    public async previewSplit(str: string): Promise<ChapterParseResult[]> {
        return this.splitVideoService.previewSplit(str);
    }

    public async split({
                           videoPath,
                           srtPath,
                           chapters
                       }: {
        videoPath: string,
        srtPath: string | null,
        chapters: ChapterParseResult[]
    }): Promise<string> {
        return await this.splitVideoService.splitByChapters({
            videoPath,
            srtPath,
            chapters
        });
    }


    public async thumbnail({filePath, time}: { filePath: string, time: number }): Promise<string> {
        return this.mediaService.thumbnail(filePath, time);
    }

    public videoLength(filePath: string): Promise<number> {
        return this.ffmpegService.duration(filePath);
    }


    registerRoutes(): void {
        registerRoute('split-video/preview', (p)=>this.previewSplit(p));
        registerRoute('split-video/split', (p)=>this.split(p));
        registerRoute('split-video/thumbnail', (p)=>this.thumbnail(p));
        registerRoute('split-video/video-length', (p)=>this.videoLength(p));
    }
}
