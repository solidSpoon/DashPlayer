import LocationService, { ProgramType } from '@/backend/services/LocationService';
import { cookieType, DlVideoContext } from '@/common/types/DlVideoType';
import { spawn } from 'child_process';
import ChildProcessTask from '@/backend/objs/ChildProcessTask';
import dpLog from '@/backend/ioc/logger';
import container from '@/backend/ioc/inversify.config';
import TYPES from '@/backend/ioc/types';
import { Cancelable } from '@/common/interfaces';

export class DlpDownloadVideo implements Cancelable {
    private onLog: (progress:number, msg: string) => void = () => {
        return;
    };

    public setOnLog(callback: (progress:number, msg: string) => void) {
        this.onLog = callback;
    }

    private log(msg: string) {
        dpLog.info(msg);
        this.onLog(this.progress, msg);
    }

    readonly context: DlVideoContext;
    readonly ytDlpPath: string;
    readonly ffmpegPath: string;
    private task: ChildProcessTask | null = null;
    private progress = 0;

    constructor(context: DlVideoContext) {
        const locationService = container.get<LocationService>(TYPES.LocationService);
        this.ytDlpPath = locationService.getThirdLibPath(ProgramType.YT_DL);
        this.ffmpegPath = locationService.getThirdLibPath(ProgramType.LIB);
        this.context = context;
    }

    public cancel(): void {
        if (this.task) {
            this.task.cancel();
        }
    }


    public async run(): Promise<void> {
        this.log('System: downloading video');

        return new Promise<void>((resolve, reject) => {

            const cookiesArg = this.context.cookies === cookieType('no-cookie') ? [] : ['--cookies-from-browser', this.context.cookies];

            const args = [
                '--ffmpeg-location',
                this.ffmpegPath,
                '-f',
                'bestvideo[height<=1080][height>=?720]+bestaudio/best',
                ...cookiesArg,
                '-o',
                '%(title)s.%(ext)s',
                '--merge-output-format',
                'mp4',
                '--remux-video',
                'mp4',
                '-P',
                this.context.savePath,
                this.context.url
            ];

            const ytDlpProcess = spawn(this.ytDlpPath, args);

            ytDlpProcess.stdout.setEncoding('utf8');
            ytDlpProcess.stderr.setEncoding('utf8');
            let percentProgress = 0;

            this.task = new ChildProcessTask(ytDlpProcess);

            ytDlpProcess.stdout.on('data', (data: string) => {
                const progressMatch = data.match(/\[download\]\s+(\d+(\.\d+)?)%/);
                if (progressMatch) {
                    percentProgress = parseFloat(progressMatch[1]);
                    console.log(`Download progress: ${percentProgress}%`);
                    this.progress = percentProgress;
                }
                this.log(data);
            });

            ytDlpProcess.stderr.on('data', (data: string) => {
                this.log(data);
            });

            ytDlpProcess.on('close', (code: number) => {
                console.log(`yt-dlp process exited with code ${code}`);
                if (code === 0) {
                    resolve();
                } else {
                    const errorMsg = `yt-dlp process exited with code ${code}`;
                    this.log(errorMsg);
                    reject(new Error(errorMsg));
                }
            });
        });
    }
}
