import { Cancelable } from '@/common/interfaces';
import { ChildProcess } from 'child_process';

export default class ChildProcessTask implements Cancelable {
    private readonly process: ChildProcess;

    constructor(process: ChildProcess) {
        this.process = process;
    }

    cancel(): void {
        this.process.kill();
    }
}
