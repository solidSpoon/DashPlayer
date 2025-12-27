import dpLog, { getMainLogger } from '@/backend/infrastructure/logger';
import parseChapter from '@/common/utils/praser/chapter-parser';
import path from 'path';
import fs from 'fs';
import { ChapterParseResult } from '@/common/types/chapter-result';
import hash from 'object-hash';
import TimeUtil from '@/common/utils/TimeUtil';
import StrUtil from '@/common/utils/str-util';
import FileUtil from '@/backend/utils/FileUtil';
import { inject, injectable } from 'inversify';
import FfmpegService from '@/backend/application/services/FfmpegService';
import TYPES from '@/backend/ioc/types';
import SplitVideoService from '@/backend/application/services/SplitVideoService';
import SrtUtil from "@/common/utils/SrtUtil";



@injectable()
class SplitVideoServiceImpl implements SplitVideoService {

    @inject(TYPES.FfmpegService)
    private ffmpegService!: FfmpegService;
    private logger = getMainLogger('SplitVideoServiceImpl');

    public async previewSplit(str: string) {
        return parseChapter(str);
    }

    async splitByChapters({
                     videoPath,
                     srtPath,
                     chapters
                 }: {
        videoPath: string,
        srtPath: string | null,
        chapters: ChapterParseResult[]
    }) {
        const folderName = path.join(path.dirname(videoPath), path.basename(videoPath, path.extname(videoPath)));
        const splitVideos = await this.splitVideoPart(videoPath, chapters, folderName);
        if (StrUtil.isBlank(srtPath) || !fs.existsSync(srtPath)) {
            dpLog.error('srtPath is blank or not exists');
            return folderName;
        }
        const srtSplit: {
            start: number,
            end: number,
            name: string,
            duration: number
        }[] = [];
        let offset = -0.2;
        for (const v of splitVideos) {
            const duration = await this.ffmpegService.duration(v);
            // 同名srt
            srtSplit.push({
                start: offset,
                end: offset + duration,
                name: v.replace(path.extname(v), '.srt'),
                duration
            });
            offset += duration;
        }

        const content = await FileUtil.read(srtPath);
        if (content === null) {
            dpLog.error('read srt file failed');
            return folderName;
        }
        const srt = SrtUtil.parseSrt(content);
        for (const srtItem of srtSplit) {
            const lines = srt
                .filter(line => line.end >= srtItem.start && line.start <= srtItem.end)
                .map((line, index) => ({
                    index: index + 1,
                    start: Math.max(line.start - srtItem.start, 0),
                    end: Math.min(line.end - srtItem.start, srtItem.duration),
                    contentEn: line.contentEn,
                    contentZh: line.contentZh
                }));
            const srtContent = SrtUtil.srtLinesToSrt(lines, {
                reindex: true
            });
            fs.writeFileSync(srtItem.name, srtContent);
        }
        return folderName;
    }

    private async splitVideoPart(videoPath: string, chapters: ChapterParseResult[], folderName: string) {
        if (!fs.existsSync(folderName)) {
            fs.mkdirSync(folderName, { recursive: true });
        }
        const tempFilePrefix = hash(videoPath);
        const cs = chapters.map(chapter => {
            return {
                name: chapter.title,
                time: TimeUtil.parseDuration(chapter.timestampStart),
                timeStr: chapter.timestampStart
            };
        });
        const outputFiles = await this.ffmpegService.splitVideoByTimes({
            inputFile: videoPath,
            times: cs.map(c => c.time).filter(t => t > 0),
            outputFolder: folderName,
            outputFilePrefix: tempFilePrefix
        });
        this.logger.info('video split completed', { fileCount: outputFiles.length });
        const splitedVideos: string[] = [];
        // 重命名
        for (let i = 0; i < outputFiles.length; i++) {
            const c = cs[i];
            const file = outputFiles[i];
            const newName = path.join(folderName, `${c.timeStr}-${c.name}${path.extname(file)}`.replaceAll(':', ''));
            fs.renameSync(file, newName);
            splitedVideos.push(newName);
        }
        return splitedVideos;
    }
}


export default SplitVideoServiceImpl;
