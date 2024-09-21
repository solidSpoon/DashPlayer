import { DpTaskState } from '@/backend/db/tables/dpTask';
import { FolderVideos } from '@/common/types/tonvert-type';
import fs from 'fs';
import path from 'path';
import { inject, injectable } from 'inversify';
import DpTaskService from '@/backend/services/DpTaskService';
import TYPES from '@/backend/ioc/types';
import FfmpegService from '@/backend/services/FfmpegService';
import ConvertService from '@/backend/services/ConvertService';


@injectable()
export default class ConvertServiceImpl implements ConvertService {
    @inject(TYPES.DpTaskService)
    private dpTaskService: DpTaskService;

    @inject(TYPES.FfmpegService)
    private ffmpegService: FfmpegService;

    public async toMp4(taskId: number, file: string): Promise<void> {
        const mp4File = file.replace(path.extname(file), '.mp4');
        const onProgress = (progress: number) => {
            this.dpTaskService.process(taskId, {
                progress: `正在转换`,
                result: JSON.stringify({
                    progress,
                    path: mp4File
                })
            });
        };

        this.dpTaskService.process(taskId, {
            progress: '正在转换',
            result: JSON.stringify({
                progress: 0,
                path: mp4File
            })
        });
        // 如果没有对应的 mkv
        if (!fs.existsSync(mp4File)) {
            try {
                await this.ffmpegService.mkvToMp4({
                    taskId,
                    inputFile: file,
                    onProgress
                });
            } catch (e) {
                console.error('转换失败', e);
                this.dpTaskService.fail(taskId, {
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
                await this.ffmpegService.extractSubtitles({
                    taskId,
                    inputFile: file,
                    onProgress,
                    en: true
                });
                // 如果生成文件大小为 0
                if (!fs.existsSync(srtName) || fs.statSync(srtName).size === 0) {
                    await this.ffmpegService.extractSubtitles({
                        taskId,
                        inputFile: file,
                        onProgress,
                        en: false
                    });
                }
            } catch (e) {
                console.error('提取字幕失败', e);
            }
        }
        this.dpTaskService.finish(taskId, {
            progress: '转换完成',
            result: JSON.stringify({
                progress: 100,
                path: mp4File
            })
        });
    }

    public async fromFolder(folders: string[]): Promise<FolderVideos[]> {
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
