import { ChildProcess } from 'child_process';
import Ffmpeg from 'fluent-ffmpeg';
import { CancelTokenSource } from 'axios';

export default interface ChildProcessService {
    registerTask(taskId: number, process: ChildProcess[]): void;

    registerFfmpeg(taskId: number, process: Ffmpeg.FfmpegCommand[]): void;

    registerCancelTokenSource(taskId: number, process: CancelTokenSource[]): void;

    killTask(taskId: number): void;
}

