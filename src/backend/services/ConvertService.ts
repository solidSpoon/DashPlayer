import FfmpegService from "@/backend/services/FfmpegService";
import DpTaskService from "@/backend/services/DpTaskService";
import {DpTaskState} from "@/backend/db/tables/dpTask";
import { ConvertResult, FolderVideos } from '@/common/types/tonvert-type';
import fs from 'fs';
import path from 'path';
export default class ConvertService {
    public static async toMp4(taskId: number, file: string): Promise<void> {
        const mp4File = file.replace(path.extname(file), '.mp4')
        const onProgress = (progress: number) => {
            DpTaskService.update({
                id: taskId,
                status: DpTaskState.IN_PROGRESS,
                progress: `正在转换`,
                result: JSON.stringify({
                    progress,
                    path: mp4File
                })
            })
        }

        DpTaskService.update({
            id: taskId,
            status: DpTaskState.IN_PROGRESS,
            progress: '正在转换',
            result: JSON.stringify({
                progress: 0,
                path: mp4File
            })
        });
        // 如果没有对应的 mkv
        if (!fs.existsSync(mp4File)) {
            try {
                await FfmpegService.mkvToMp4({
                    taskId,
                    inputFile: file,
                    onProgress
                });
            } catch (e) {
                console.error('转换失败', e);
                DpTaskService.update({
                    id: taskId,
                    status: DpTaskState.FAILED,
                    progress: '转换失败',
                    result: JSON.stringify({
                        progress: 0,
                        path: mp4File
                    })
                });
                return;
            }
        }
        // 如果没有对应的 srt
        const srtName = mp4File.replace('.mp4', '.srt');
        if (!fs.existsSync(srtName)) {
            try {
                await FfmpegService.extractSubtitles({
                    taskId,
                    inputFile: file,
                    onProgress,
                    en:true,
                });
                // 如果生成文件大小为 0
                if (!fs.existsSync(srtName) || fs.statSync(srtName).size === 0) {
                    await FfmpegService.extractSubtitles({
                        taskId,
                        inputFile: file,
                        onProgress,
                        en:false,
                    });
                }
            } catch (e) {
                console.error('提取字幕失败', e);
            }
        }
        DpTaskService.update({
            id: taskId,
            status: DpTaskState.DONE,
            progress: '转换完成',
            result: JSON.stringify({
                progress: 100,
                path: mp4File
            })
        });
    }

    public static async fromFolder(folders: string[]): Promise<FolderVideos[]> {
        const result: FolderVideos[] = [];
        for (const folder of folders) {
            const mkvFiles = fs.readdirSync(folder).filter(file => file.endsWith('.mkv'));
            result.push({
                folder,
                videos: mkvFiles.map(file => path.join(folder, file))
            });
        }
        return result;
    }
}
