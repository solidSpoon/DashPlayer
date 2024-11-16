import { spawn } from 'child_process';
import DpTaskServiceImpl from '@/backend/services/impl/DpTaskServiceImpl';
import { DlProgress } from '@/common/types/dl-progress';
import path from 'path';
import fs from 'fs';
import { inject, injectable } from 'inversify';
import TYPES from '@/backend/ioc/types';
import LocationService, { ProgramType } from '@/backend/services/LocationService';
import FfmpegService from '@/backend/services/FfmpegService';
import ChildProcessTask from '@/backend/objs/ChildProcessTask';
import DlVideoService from '@/backend/services/DlVideoService';

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
    @inject(TYPES.LocationService)
    private locationService!: LocationService;

    @inject(TYPES.DpTaskService)
    private dpTaskService!: DpTaskServiceImpl;

    @inject(TYPES.FfmpegService)
    private ffmpegService!: FfmpegService;

    public async dlVideo(taskId: number, url: string, savePath: string) {
        const progress = new DownloadProgress();
        progress.appendStdOut(`System: downloading video from ${url}`);
        this.dpTaskService.process(taskId, {
            progress: '正在下载',
            result: JSON.stringify(progress.toJSON())
        });

        try {
            // Get the video file name
            const videoFileName = await this.getVideoFileName(taskId, progress, url);
            progress.name = path.basename(videoFileName, path.extname(videoFileName)) + '.mp4';

            // Download the video
            await this.downloadVideo(taskId, progress, url, savePath);

            // If the downloaded file is not mp4, convert it
            if (!videoFileName.endsWith('.mp4')) {
                const videoPath = path.join(savePath, videoFileName);
                if (fs.existsSync(videoPath)) {
                    progress.appendStdOut('System: converting video to mp4');
                    this.dpTaskService.process(taskId, {
                        progress: '正在转换',
                        result: JSON.stringify(progress.toJSON())
                    });

                    await this.ffmpegService.toMp4({
                        inputFile: videoPath,
                        onProgress: (percent) => {
                            progress.progress = percent;
                            progress.appendStdOut(`System: converting video to mp4 ${percent}%`);
                            this.dpTaskService.process(taskId, {
                                progress: `正在转换 ${percent}%`,
                                result: JSON.stringify(progress.toJSON())
                            });
                        }
                    });

                    fs.unlinkSync(videoPath);
                    progress.appendStdOut('System: video converted to mp4');
                    progress.name = path.basename(videoPath, path.extname(videoPath)) + '.mp4';
                    this.dpTaskService.process(taskId, {
                        progress: '转换完成',
                        result: JSON.stringify(progress.toJSON())
                    });
                }
            }
        } catch (error: any) {
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

    private async getVideoFileName(
        taskId: number,
        progress: DownloadProgress,
        url: string
    ): Promise<string> {
        const ytDlpPath = this.locationService.getThirdLibPath(ProgramType.YT_DL);
        const ffmpegPath = this.locationService.getThirdLibPath(ProgramType.LIB);

        progress.appendStdOut('System: fetching video file name');
        this.dpTaskService.process(taskId, {
            progress: '正在获取文件名',
            result: JSON.stringify(progress.toJSON())
        });

        return new Promise<string>((resolve, reject) => {
            let output = '';

            const ytDlpProcess = spawn(ytDlpPath, [
                '--ffmpeg-location',
                ffmpegPath,
                '-f',
                'bestvideo[height<=1080][height>=?720]',
                '--cookies-from-browser', 'chrome',
                '--get-filename',
                '--merge-output-format',
                'mp4',
                url
            ]);

            ytDlpProcess.stdout.setEncoding('utf8');

            this.dpTaskService.registerTask(taskId, new ChildProcessTask(ytDlpProcess));

            ytDlpProcess.stdout.on('data', (data: string) => {
                output += data.toString();
                progress.appendStdOut(data.toString());
            });

            ytDlpProcess.stderr.on('data', (data: string) => {
                console.error('Error:', data.toString());
                progress.appendStdOut(data.toString());
            });

            ytDlpProcess.on('close', (code: number) => {
                if (code === 0 && output.trim()) {
                    resolve(output.trim());
                } else {
                    const errorMsg = `yt-dlp process exited with code ${code}`;
                    progress.appendStdOut(errorMsg);
                    reject(new Error(errorMsg));
                }
            });
        });
    }

    private async downloadVideo(
        taskId: number,
        progress: DownloadProgress,
        url: string,
        savePath: string
    ): Promise<void> {
        progress.appendStdOut('System: downloading video');
        this.dpTaskService.process(taskId, {
            progress: '正在下载',
            result: JSON.stringify(progress.toJSON())
        });

        return new Promise<void>((resolve, reject) => {
            const ytDlpPath = this.locationService.getThirdLibPath(ProgramType.YT_DL);
            const ffmpegPath = this.locationService.getThirdLibPath(ProgramType.LIB);

            const args = [
                '--ffmpeg-location',
                ffmpegPath,
                '-f',
                'bestvideo[height<=1080][height>=?720]+bestaudio/best',
                '--cookies-from-browser', 'chrome',
                '--merge-output-format',
                'mp4',
                '-P',
                savePath,
                url
            ];

            const ytDlpProcess = spawn(ytDlpPath, args);

            ytDlpProcess.stdout.setEncoding('utf8');
            ytDlpProcess.stderr.setEncoding('utf8');
            let percentProgress = 0;

            this.dpTaskService.registerTask(taskId, new ChildProcessTask(ytDlpProcess));

            ytDlpProcess.stdout.on('data', (data: string) => {
                console.log(data);
                progress.appendStdOut(data);

                const progressMatch = data.match(/\[download\]\s+(\d+(\.\d+)?)%/);
                if (progressMatch) {
                    percentProgress = parseFloat(progressMatch[1]);
                    console.log(`Download progress: ${percentProgress}%`);
                    progress.progress = percentProgress;

                    this.dpTaskService.process(taskId, {
                        progress: `正在下载 ${percentProgress}%`,
                        result: JSON.stringify(progress.toJSON())
                    });
                }
            });

            ytDlpProcess.stderr.on('data', (data: string) => {
                console.error(`stderr: ${data}`);
                progress.appendStdOut(data);
            });

            ytDlpProcess.on('close', (code: number) => {
                console.log(`yt-dlp process exited with code ${code}`);
                if (code === 0) {
                    resolve();
                } else {
                    const errorMsg = `yt-dlp process exited with code ${code}`;
                    progress.appendStdOut(errorMsg);
                    this.dpTaskService.fail(taskId, {
                        progress: '下载失败',
                        result: JSON.stringify(progress.toJSON())
                    });
                    reject(new Error(errorMsg));
                }
            });
        });
    }
}
