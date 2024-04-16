import parseChapter, {timeStrToSecond, isTimeStrValid} from "@/common/utils/praser/chapter-parser";
import path from "path";
import fs from "fs";
import ffmpeg from "fluent-ffmpeg";
import ffmpeg_static from "ffmpeg-static";
import {ParseResult} from "@/common/types/chapter-result";
import {strBlank} from "@/common/utils/Util";
import FfmpegService from "@/backend/services/FfmpegService";

class SplitVideoService {
    public static async previewSplit(str: string) {
        return parseChapter(str);
    }


    static async split(filePath: string, param: ParseResult): Promise<void> {
        if (!isTimeStrValid(param.timestampStart.value) || !isTimeStrValid(param.timestampEnd.value) || strBlank(param.title)) {
            return;
        }
        const startSecond = timeStrToSecond(param.timestampStart.value);
        const endSecond = timeStrToSecond(param.timestampEnd.value);
        if (startSecond >= endSecond) {
            return;
        }
        const folderName = path.basename(filePath, path.extname(filePath));
        if (!fs.existsSync(folderName)) {
            fs.mkdirSync(folderName, {recursive: true});
        }
        const fileName = path.join(folderName, `${param.title}.${path.extname(filePath)}`);
        ffmpeg.setFfmpegPath(ffmpeg_static);

        //ffmpeg -y -ss {} -t {} -accurate_seek -i {} -codec copy  -avoid_negative_ts 1 {}
        await FfmpegService.splitVideo({
            inputFile: filePath,
            startSecond,
            endSecond,
            outputFile: fileName
        });
    }


}


export default SplitVideoService;
