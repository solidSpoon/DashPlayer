import DpTaskServiceImpl from '@/backend/services/impl/DpTaskServiceImpl';
import { DlProgress } from '@/common/types/dl-progress';
import path from 'path';
import { inject, injectable } from 'inversify';
import TYPES from '@/backend/ioc/types';
import DlVideoService from '@/backend/services/DlVideoService';
import { COOKIE, DlVideoContext } from '@/common/types/DlVideoType';
import { DlpFetchFileName } from '@/backend/objs/dl-video/DlpFetchFileName';
import { DlpDownloadVideo } from '@/backend/objs/dl-video/DlpDownloadVideo';

class DownloadProgress {
    name = '';
    progress = 0;
    private stdOutLines: string[] = [];

    public appendStdOut(line: string) {
        this.stdOutLines.push(line.trim());
    }

    public get stdOut(): string {
        return this.stdOutLines.join('\n');
    }

    public toJSON(): DlProgress {
        return {
            name: this.name,
            progress: this.progress,
            stdOut: this.stdOut
        };
    }
}

@injectable()
export default class DlVideoServiceImpl implements DlVideoService {
    @inject(TYPES.DpTaskService)
    private dpTaskService!: DpTaskServiceImpl;
    public async dlVideo(taskId: number, url: string, cookies: string, savePath: string) {
        const progress = new DownloadProgress();
        progress.appendStdOut(`System: downloading video from ${url}`);
        this.dpTaskService.process(taskId, {
            progress: '正在下载',
            result: JSON.stringify(progress.toJSON())
        });

        const context: DlVideoContext = {
            taskId,
            url,
            cookies: cookies as COOKIE,
            savePath
        };

        try {
            const fetchFileName = new DlpFetchFileName(context);
            fetchFileName.setOnLog((msg) => {
                progress.appendStdOut(msg);
                this.dpTaskService.process(taskId, {
                    progress: '正在获取文件名',
                    result: JSON.stringify(progress.toJSON())
                });
            });
            const videoFileName = await fetchFileName.run();
            this.dpTaskService.registerTask(taskId, fetchFileName);
            progress.name = path.basename(videoFileName, path.extname(videoFileName)) + '.mp4';


            const dlpDownloadVideo = new DlpDownloadVideo(context);
            dlpDownloadVideo.setOnLog((p, msg) => {
                progress.progress = p;
                progress.appendStdOut(msg);
                this.dpTaskService.process(taskId, {
                    progress: `正在下载 ${p}%`,
                    result: JSON.stringify(progress.toJSON())
                });
            });
            await dlpDownloadVideo.run();
            this.dpTaskService.registerTask(taskId, dlpDownloadVideo);
        } catch (error: unknown) {
            progress.appendStdOut(`Error: ${error.message || error}`);
            this.dpTaskService.fail(taskId, {
                progress: '下载失败',
                result: JSON.stringify(progress.toJSON())
            });
            return;
        }

        this.dpTaskService.finish(taskId, {
            progress: '下载完成',
            result: JSON.stringify(progress.toJSON())
        });
    }
}
