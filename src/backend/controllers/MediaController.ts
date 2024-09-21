import {ChapterParseResult} from '@/common/types/chapter-result';
import registerRoute from '@/common/api/register';
import path from 'path';
import * as os from 'node:os';
import FfmpegServiceImpl from '@/backend/services/impl/FfmpegServiceImpl';
import fs from 'fs';
import TimeUtil from '@/common/utils/TimeUtil';
import hash from 'object-hash';
import UrlUtil from '@/common/utils/UrlUtil';
import { inject, injectable } from 'inversify';
import Controller from '@/backend/interfaces/controller';
import TYPES from '@/backend/ioc/types';
import SplitVideoService from '@/backend/services/SplitVideoService';

@injectable()
export default class MediaController implements Controller {

    @inject(TYPES.SplitVideoService)
    private splitVideoService: SplitVideoService;

    @inject(TYPES.FfmpegService)
    private ffmpegService: FfmpegServiceImpl;

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
        return await this.splitVideoService.split2({
            videoPath,
            srtPath,
            chapters
        });
    }


    public async thumbnail({filePath, time}: { filePath: string, time: number }): Promise<string> {
        const finalTime = TimeUtil.toGroupMiddle(time);
        const tmpdir = path.join(os.tmpdir(), 'dp/thumbnail');
        if (!fs.existsSync(tmpdir)) {
            fs.mkdirSync(tmpdir, {recursive: true});
        }
        const fileName = `${hash(filePath)}-${Math.floor(finalTime)}.jpg`;
        if (fs.existsSync(path.join(tmpdir, fileName))) {
            return UrlUtil.dp(path.join(tmpdir, fileName));
        }
        await this.ffmpegService.thumbnail({
            inputFile: filePath,
            outputFileName: fileName,
            outputFolder: tmpdir,
            time: finalTime
        });
        return UrlUtil.dp(path.join(tmpdir, fileName));
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
