import {ChildProcess} from "child_process";
import DpTaskService from "@/backend/services/DpTaskService";
import {DpTaskState} from "@/backend/db/tables/dpTask";
import Ffmpeg from "fluent-ffmpeg";
import {CancelTokenSource} from "axios";

export default class ProcessService {
    private static readonly taskProcessMapping: Map<number, ChildProcess[]> = new Map();
    private static readonly taskFfmpegMapping: Map<number, Ffmpeg.FfmpegCommand[]> = new Map();
    //cancelTokenSource
    private static readonly cancelTokenSourceMapping: Map<number, CancelTokenSource[]> = new Map();

    public static registerTask({
                                   taskId,
                                   process
                               }: {
        taskId: number,
        process: ChildProcess []
    }) {
        const ps = ProcessService.taskProcessMapping.get(taskId);
        if (ps) {
            ProcessService.taskProcessMapping.set(taskId, [...ps, ...process]);
        } else {
            ProcessService.taskProcessMapping.set(taskId, process);
        }
        process.forEach(p => {
            p.on('close', () => {
                const ps = ProcessService.taskProcessMapping.get(taskId);
                if (ps) {
                    const newPs = ps.filter(pp => pp !== p);
                    ProcessService.taskProcessMapping.set(taskId, newPs);
                }
            });
        });
    }

    public static registerFfmpeg({
                                     taskId,
                                     process
                                 }: {
        taskId: number,
        process: Ffmpeg.FfmpegCommand[]
    }) {
        const ps = ProcessService.taskFfmpegMapping.get(taskId);
        if (ps) {
            ProcessService.taskFfmpegMapping.set(taskId, [...ps, ...process]);
        } else {
            ProcessService.taskFfmpegMapping.set(taskId, process);
        }
        process.forEach(p => {
            p.on('end', () => {
                const ps = ProcessService.taskFfmpegMapping.get(taskId);
                if (ps) {
                    const newPs = ps.filter(pp => pp !== p);
                    ProcessService.taskFfmpegMapping.set(taskId, newPs);
                }
            });
        });
    }

    public static registerCancelTokenSource({
                                                taskId,
                                                process
                                            }: { taskId: number, process: CancelTokenSource[] }) {
        const ps = ProcessService.cancelTokenSourceMapping.get(taskId);
        if (ps) {
            ProcessService.cancelTokenSourceMapping.set(taskId, [...ps, ...process]);
        } else {
            ProcessService.cancelTokenSourceMapping.set(taskId, process);
        }
    }

    public static killTask(taskId: number) {
        ProcessService.killProcess(taskId);
        ProcessService.killFfmpeg(taskId);
    }

    private static killProcess(taskId: number) {
        const childProcesses = ProcessService.taskProcessMapping.get(taskId);
        if (childProcesses) {
            childProcesses.forEach(p => {
                p.on('close', () => {
                    DpTaskService.update({
                        id: taskId,
                        status: DpTaskState.CANCELLED,
                        progress: '任务取消',
                    });
                });
                p.kill();
            });
        }
    }

    private static killFfmpeg(taskId: number) {
        const childProcesses = ProcessService.taskFfmpegMapping.get(taskId);
        if (childProcesses) {
            childProcesses.forEach(p => {
                p.on('end', () => {
                    DpTaskService.update({
                        id: taskId,
                        status: DpTaskState.CANCELLED,
                        progress: '任务取消',
                    });
                });
                p.kill('SIGKILL');
            });
        }
    }
}
