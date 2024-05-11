import {ChildProcess} from "child_process";
import DpTaskService from "@/backend/services/DpTaskService";
import {DpTaskState} from "@/backend/db/tables/dpTask";

export default class ProcessService {
    private static readonly taskProcessMapping: Map<number, ChildProcess[]> = new Map();

    public static registerTask({
                                   taskId,
                                   process
                               }: {
        taskId: number,
        process: ChildProcess[]
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

    public static killTask(taskId: number) {
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
}
