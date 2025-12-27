import { Cancelable } from '@/common/interfaces';
import Ffmpeg from 'fluent-ffmpeg';

export default class FfmpegTask implements Cancelable {
    private readonly command: Ffmpeg.FfmpegCommand;

    constructor(command: Ffmpeg.FfmpegCommand) {
        this.command = command;
    }

    cancel(): void {
        this.command.kill('SIGKILL');
    }
}
