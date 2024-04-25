import parseChapter, {timeStrToSecond, isTimeStrValid} from "@/common/utils/praser/chapter-parser";
import path from "path";
import fs from "fs";
import {ChapterParseResult} from "@/common/types/chapter-result";
import {strBlank} from "@/common/utils/Util";
import FfmpegService from "@/backend/services/FfmpegService";
import DpTaskService from "@/backend/services/DpTaskService";
import {DpTaskState} from "@/backend/db/tables/dpTask";
import SrtUtil from "@/common/utils/SrtUtil";

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
        if (!isTimeStrValid(chapter.timestampStart.value) || !isTimeStrValid(chapter.timestampEnd.value) || strBlank(chapter.title)) {
            return;
        }
        const startSecond = timeStrToSecond(chapter.timestampStart.value);
        const endSecond = timeStrToSecond(chapter.timestampEnd.value);
        if (startSecond >= endSecond) {
            return;
        }
        const folderName = path.join(path.dirname(videoPath), path.basename(videoPath, path.extname(videoPath)));
        if (!fs.existsSync(folderName)) {
            fs.mkdirSync(folderName, {recursive: true});
        }


        const keyFrameTime = await FfmpegService.keyFrameAt(videoPath, startSecond);

        const videoOutName = path.join(folderName, `${chapter.timestampStart.value}-${chapter.title}${path.extname(videoPath)}`.replaceAll(':', '_'));

        await DpTaskService.update({
            id: taskId,
            status: DpTaskState.IN_PROGRESS,
            progress: '分割中'
        });
        const t = await FfmpegService.keyFrameAt(videoPath, startSecond);
        console.log('keyFrameAt', startSecond, ': ', t);
        await FfmpegService.splitVideo({
            inputFile: videoPath,
            startSecond: keyFrameTime,
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

        const srtOutName = path.join(folderName, `${chapter.timestampStart.value}-${chapter.title}.srt`.replaceAll(':', '_'));
        // SrtUtil.parseSrt()
        const content = fs.readFileSync(srtPath, 'utf-8');
        const srt = SrtUtil.parseSrt(content);
        const lines = srt.filter(line => line.start >= keyFrameTime && line.end <= endSecond)
            .map((line, index) => ({
                index: index + 1,
                start: line.start - keyFrameTime,
                end: line.end - keyFrameTime,
                contentEn: line.contentEn,
                contentZh: line.contentZh
            }));
        const srtContent = SrtUtil.toSrt(lines);
        fs.writeFileSync(srtOutName, srtContent);
        return srtOutName;

    }


}


export default SplitVideoService;
