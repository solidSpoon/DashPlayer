import { ChildProcess } from 'child_process';
import DpTaskServiceImpl from '@/backend/services/impl/DpTaskServiceImpl';
import { DpTaskState } from '@/backend/db/tables/dpTask';
import Ffmpeg from 'fluent-ffmpeg';
import { CancelTokenSource } from 'axios';
import { inject, injectable } from 'inversify';
import TYPES from '@/backend/ioc/types';
import DpTaskService from '@/backend/services/DpTaskService';
import ChildProcessService from '@/backend/services/ChildProcessService';


@injectable()
export default class ChildProcessServiceImpl implements ChildProcessService {

    @inject(TYPES.DpTaskService)
    private dpTaskService!: DpTaskService;

    private taskProcessMapping: Map<number, ChildProcess[]> = new Map();
    private taskFfmpegMapping: Map<number, Ffmpeg.FfmpegCommand[]> = new Map();
    private cancelTokenSourceMapping: Map<number, CancelTokenSource[]> = new Map();

    public registerTask(taskId: number, process: ChildProcess[]) {
        this.register(taskId, process, this.taskProcessMapping, 'close');
    }

    public registerFfmpeg(taskId: number, process: Ffmpeg.FfmpegCommand[]) {
        this.register(taskId, process, this.taskFfmpegMapping, 'end');
    }

    public registerCancelTokenSource(taskId: number, process: CancelTokenSource[]) {
        this.register(taskId, process, this.cancelTokenSourceMapping);
    }

    private register(taskId: number, process: any[], mapping: Map<number, any[]>, event?: string) {
        const existingProcesses = mapping.get(taskId) || [];
        mapping.set(taskId, [...existingProcesses, ...process]);

        if (event) {
            process.forEach(p => {
                p.on(event, () => {
                    const processes = mapping.get(taskId);
                    if (processes) {
                        const newProcesses = processes.filter(pp => pp !== p);
                        mapping.set(taskId, newProcesses);
                    }
                });
            });
        }
    }

    public killTask(taskId: number) {
        this.killProcess(taskId, this.taskProcessMapping);
        this.killProcess(taskId, this.taskFfmpegMapping, 'SIGKILL');
        this.killRequest(taskId);
        this.dpTaskService.cancel(taskId);
    }

    private killProcess(taskId: number, mapping: Map<number, any[]>, signal?: string) {
        const childProcesses = mapping.get(taskId);
        if (childProcesses) {
            childProcesses.forEach(p => {
                p.on('close', () => {
                    this.dpTaskService.cancel(taskId);
                });
                p.kill(signal);
            });
        }
    }

    private killRequest(taskId: number) {
        const cancelTokenSources = this.cancelTokenSourceMapping.get(taskId);
        if (cancelTokenSources) {
            cancelTokenSources.forEach(c => {
                c.cancel('Task cancelled');
            });
        }
    }
}
