import parseChapter from '@/common/utils/praser/chapter-parser';
import path from 'path';
import fs from 'fs';
import {ChapterParseResult} from '@/common/types/chapter-result';
import {strBlank} from '@/common/utils/Util';
import FfmpegService from '@/backend/services/FfmpegService';
import DpTaskService from '@/backend/services/DpTaskService';
import {DpTaskState} from '@/backend/db/tables/dpTask';
import SrtUtil from '@/common/utils/SrtUtil';
import hash from "object-hash";
import TimeUtil from "@/common/utils/TimeUtil";

class SplitVideoService {
    public static async previewSplit(str: string) {
        return parseChapter(str);
    }

    static async split(taskId: number, {
        videoPath,
        srtPath,
        chapter
    }: {
        videoPath: string,
        srtPath: string | null,
        chapter: ChapterParseResult
    }) {
        if (strBlank(videoPath)) return;
        // todo 验证
        // if (!TimeUtil.verifyDuration(chapter.timestampStart) || !TimeUtil.verifyDuration(chapter.timestampEnd) || strBlank(chapter.title)) {
        //     return;
        // }
        const startSecond = TimeUtil.parseDuration(chapter.timestampStart);
        const endSecond = TimeUtil.parseDuration(chapter.timestampEnd);
        if (startSecond >= endSecond) {
            return;
        }
        const folderName = path.join(path.dirname(videoPath), path.basename(videoPath, path.extname(videoPath)));
        if (!fs.existsSync(folderName)) {
            fs.mkdirSync(folderName, {recursive: true});
        }


        const keyFrameTime = await FfmpegService.keyFrameAt(videoPath, startSecond);

        const videoOutName = path.join(folderName, `${chapter.timestampStart}-${chapter.title}${path.extname(videoPath)}`.replaceAll(':', ''));

        await DpTaskService.update({
            id: taskId,
            status: DpTaskState.IN_PROGRESS,
            progress: '分割中'
        });
        const t = await FfmpegService.keyFrameAt(videoPath, startSecond);
        console.log('keyFrameAt', startSecond, ': ', t);
        await FfmpegService.splitVideo({
            inputFile: videoPath,
            startSecond: keyFrameTime + 1,
            endSecond,
            outputFile: videoOutName
        });
        await DpTaskService.update({
            id: taskId,
            status: DpTaskState.DONE,
            progress: '分割完成'
        });

        if (strBlank(srtPath) || !fs.existsSync(srtPath)) {
            return;
        }

        const srtOutName = path.join(folderName, `${chapter.timestampStart}-${chapter.title}.srt`.replaceAll(':', ''));
        // SrtUtil.parseSrt()
        const content = fs.readFileSync(srtPath, 'utf-8');
        const srt = SrtUtil.parseSrt(content);
        const lines = srt.filter(line => line.start >= keyFrameTime && line.end <= endSecond)
            .map((line, index) => ({
                index: index + 1,
                start: line.start - keyFrameTime + 0.4,
                end: line.end - keyFrameTime + 0.4,
                contentEn: line.contentEn,
                contentZh: line.contentZh
            }));
        const srtContent = SrtUtil.toSrt(lines);
        fs.writeFileSync(srtOutName, srtContent);
        return srtOutName;

    }

    static async split2({
                            videoPath,
                            srtPath,
                            chapters
                        }: {
        videoPath: string,
        srtPath: string | null,
        chapters: ChapterParseResult[]
    }) {
        const folderName = path.join(path.dirname(videoPath), path.basename(videoPath, path.extname(videoPath)));
        const splitedVideos = await SplitVideoService.splitVideoPart(videoPath, chapters, folderName);
        if (strBlank(srtPath) || !fs.existsSync(srtPath)) {
            return;
        }
        const srtSplit: {
            start: number,
            end: number,
            name: string,
        }[] = [];
        let offset = 0;
        for (const v of splitedVideos) {
            const duration = await FfmpegService.duration(v);
            // 同名srt
            srtSplit.push({
                start: offset,
                end: offset + duration,
                name: v.replace(path.extname(v), '.srt')
            });
            offset += duration;
        }

        const content = fs.readFileSync(srtPath, 'utf-8');
        const srt = SrtUtil.parseSrt(content);
        for (const srtItem of srtSplit) {
            const lines = srt
                .filter(line =>
                    (line.start >= srtItem.start && line.end <= srtItem.end)
                    || (line.start <= srtItem.start && line.end >= srtItem.start)
                    || (line.start <= srtItem.end && line.end >= srtItem.end))
                .map((line, index) => ({
                    index: index + 1,
                    start: line.start - srtItem.start,
                    end: line.end - srtItem.start,
                    contentEn: line.contentEn,
                    contentZh: line.contentZh
                }));
            const srtContent = SrtUtil.toSrt(lines);
            fs.writeFileSync(srtItem.name, srtContent);
        }
        return folderName;
    }

    private static async splitVideoPart(videoPath: string, chapters: ChapterParseResult[], folderName: string) {
        if (!fs.existsSync(folderName)) {
            fs.mkdirSync(folderName, {recursive: true});
        }
        const tempFilePrefix = hash(videoPath);
        const cs = chapters.map(chapter => {
            return {
                name: chapter.title,
                time: TimeUtil.parseDuration(chapter.timestampStart),
                timeStr: chapter.timestampStart
            }
        });
        const outputFiles = await FfmpegService.splitVideoByTimes({
            inputFile: videoPath,
            times: cs.map(c => c.time).filter(t => t > 0),
            outputFolder: folderName,
            outputFilePrefix: tempFilePrefix
        });
        console.log('outputFiles', outputFiles);
        const splitedVideos: string[] = [];
        // 重命名
        for (let i = 0; i < outputFiles.length; i++) {
            const c = cs[i];
            const file = outputFiles[i];
            const newName = path.join(folderName, `${c.timeStr}-${c.name}${path.extname(file)}`.replaceAll(':', '_'));
            fs.renameSync(file, newName);
            splitedVideos.push(newName);
        }
        return splitedVideos;
    }
}


export default SplitVideoService;
