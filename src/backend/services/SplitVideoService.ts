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

    static async split(taskId: number, filePath: string, param: ChapterParseResult): Promise<void> {
        if (!isTimeStrValid(param.timestampStart.value) || !isTimeStrValid(param.timestampEnd.value) || strBlank(param.title)) {
            return;
        }
        const startSecond = timeStrToSecond(param.timestampStart.value);
        const endSecond = timeStrToSecond(param.timestampEnd.value);
        if (startSecond >= endSecond) {
            return;
        }
        const folderName = path.join(path.dirname(filePath), path.basename(filePath, path.extname(filePath)));
        if (!fs.existsSync(folderName)) {
            fs.mkdirSync(folderName, {recursive: true});
        }
        const fileName = path.join(folderName, `${param.title}${path.extname(filePath)}`);

        //ffmpeg -y -ss {} -t {} -accurate_seek -i {} -codec copy  -avoid_negative_ts 1 {}
        await DpTaskService.update({
            id: taskId,
            status: DpTaskState.IN_PROGRESS,
            progress: '分割中'
        });
        const t = await FfmpegService.keyFrameAt(filePath, startSecond);
        console.log('keyFrameAt',startSecond,': ', t);
        await FfmpegService.splitVideo({
            inputFile: filePath,
            startSecond,
            endSecond,
            outputFile: fileName
        });
        await DpTaskService.update({
            id: taskId,
            status: DpTaskState.DONE,
            progress: '分割完成'
        });
    }

    static async splitSrt(filePath: string, param: ChapterParseResult): Promise<string> {
        if (!isTimeStrValid(param.timestampStart.value) || !isTimeStrValid(param.timestampEnd.value) || strBlank(param.title)) {
            return;
        }
        const startSecond = timeStrToSecond(param.timestampStart.value);
        const endSecond = timeStrToSecond(param.timestampEnd.value);
        if (startSecond >= endSecond) {
            return;
        }
        const folderName = path.join(path.dirname(filePath), path.basename(filePath, path.extname(filePath)));
        if (!fs.existsSync(folderName)) {
            fs.mkdirSync(folderName, {recursive: true});
        }
        const fileName = path.join(folderName, `${param.title}.srt`);
        // SrtUtil.parseSrt()
        const content = fs.readFileSync(filePath, 'utf-8');
        const srt = SrtUtil.parseSrt(content);
        const lines = srt.filter(line => line.start >= startSecond && line.end <= endSecond)
            .map((line, index) => ({
                index: index + 1,
                start: line.start - startSecond,
                end: line.end - startSecond,
                contentEn: line.contentEn,
                contentZh: line.contentZh
            }));
        const srtContent = SrtUtil.toSrt(lines);
        fs.writeFileSync(fileName, srtContent);
        return fileName;
    }


}


export default SplitVideoService;
