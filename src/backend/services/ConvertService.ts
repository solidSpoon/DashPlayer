import FfmpegService from "@/backend/services/FfmpegService";
import DpTaskService from "@/backend/services/DpTaskService";
import {DpTaskState} from "@/backend/db/tables/dpTask";
import {FolderVideos} from "@/common/types/tonvert-type";
import fs from 'fs';
import path from 'path';
export default class ConvertService {
    public static async toMp4(taskId: number, file: string): Promise<void> {
        const onProgress = (progress: number) => {
            DpTaskService.update({
                id: taskId,
                status: DpTaskState.IN_PROGRESS,
                progress: `正在转换 ${progress}%`
            })
        }
        const outFile = await FfmpegService.mkvToMp4({
            inputFile: file,
            onProgress
        });
        DpTaskService.update({
            id: taskId,
            status: DpTaskState.DONE,
            progress: '转换完成',
            result: outFile
        });
    }

    public static async fromFolder(folders: string[]): Promise<FolderVideos[]> {
        const result: FolderVideos[] = [];
        for (const folder of folders) {
            const mkvFiles = fs.readdirSync(folder).filter(file => file.endsWith('.mp4'));
            result.push({
                folder,
                videos: mkvFiles.map(file => path.join(folder, file))
            });
        }
        return result;
    }
}
