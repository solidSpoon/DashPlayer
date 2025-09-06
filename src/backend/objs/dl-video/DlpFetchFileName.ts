import LocationService, { ProgramType } from '@/backend/services/LocationService';
import { cookieType, DlVideoContext } from '@/common/types/DlVideoType';
import { spawn } from 'child_process';
import ChildProcessTask from '@/backend/objs/ChildProcessTask';
import dpLog from '@/backend/ioc/logger';
import container from '@/backend/ioc/inversify.config';
import TYPES from '@/backend/ioc/types';
import { Cancelable } from '@/common/interfaces';
import { getMainLogger } from '@/backend/ioc/simple-logger';

export class DlpFetchFileName implements Cancelable {
    private onLog: (msg: string) => void = () => {
        return;
    };

    public setOnLog(callback: (msg: string) => void) {
        this.onLog = callback;
    }

    private log(msg: string) {
        dpLog.info(msg);
        this.onLog(msg);
    }

    readonly ytDlpPath: string;
    readonly ffmpegPath: string;
    private task: ChildProcessTask | null = null;
    readonly context: DlVideoContext;

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


    public async run(): Promise<string> {
        this.log('System: fetching video file name');

        return new Promise<string>((resolve, reject) => {
            let output = '';

            const cookiesArg = this.context.cookies === cookieType('no-cookie') ? [] : ['--cookies-from-browser', this.context.cookies];

            const ytDlpProcess = spawn(this.ytDlpPath, [
                '--ffmpeg-location',
                this.ffmpegPath,
                ...cookiesArg,
                '--get-filename',
                '-o',
                '%(title)s.%(ext)s',
                this.context.url
            ]);

            ytDlpProcess.stdout.setEncoding('utf8');

            this.task = new ChildProcessTask(ytDlpProcess);

            ytDlpProcess.stdout.on('data', (data: string) => {
                output += data.toString();
                this.log(data.toString());
            });

            ytDlpProcess.stderr.on('data', (data: string) => {
                getMainLogger('DlpFetchFileName').error('yt-dlp stderr', { error: data.toString() });
                this.log(data.toString());
            });

            ytDlpProcess.on('close', (code: number) => {
                if (code === 0 && output.trim()) {
                    resolve(output.trim());
                } else {
                    const errorMsg = `yt-dlp process exited with code ${code}`;
                    this.log(errorMsg);
                    reject(new Error(errorMsg));
                }
            });
        });
    }
}
