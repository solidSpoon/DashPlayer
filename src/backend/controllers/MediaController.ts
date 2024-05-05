import Controller from '@/backend/interfaces/controller';
import SplitVideoService from '@/backend/services/SplitVideoService';
import { ChapterParseResult } from '@/common/types/chapter-result';
import registerRoute from '@/common/api/register';
import path from 'path';
import * as os from 'node:os';
import FfmpegService from '@/backend/services/FfmpegService';
import fs from 'fs';
import TimeUtil from '@/common/utils/TimeUtil';
import hash from 'object-hash';
import UrlUtil from '@/common/utils/UrlUtil';

export default class MediaController implements Controller {

    public async previewSplit(str: string): Promise<ChapterParseResult[]> {
        return SplitVideoService.previewSplit(str);
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
        return await SplitVideoService.split2({
            videoPath,
            srtPath,
            chapters
        });
    }


    public async thumbnail({ filePath, time }: { filePath: string, time: number }): Promise<string> {
        const finalTime = TimeUtil.toGroupMiddle(time);
        const tmpdir = path.join(os.tmpdir(), 'dp/thumbnail');
        if (!fs.existsSync(tmpdir)) {
            fs.mkdirSync(tmpdir, { recursive: true });
        }
        const fileName = `${hash(filePath)}-${Math.floor(finalTime)}.jpg`;
        if (fs.existsSync(path.join(tmpdir, fileName))) {
            return UrlUtil.dp(path.join(tmpdir, fileName));
        }
        await FfmpegService.thumbnail({
            inputFile: filePath,
            outputFileName: fileName,
            outputFolder: tmpdir,
            time: finalTime
        });
        return UrlUtil.dp(path.join(tmpdir, fileName));
    }

    public videoLength(filePath: string): Promise<number> {
        return FfmpegService.duration(filePath);
    }


    registerRoutes(): void {
        registerRoute('split-video/preview', this.previewSplit);
        registerRoute('split-video/split', this.split);
        registerRoute('split-video/thumbnail', this.thumbnail);
        registerRoute('split-video/video-length', this.videoLength);
    }
}
