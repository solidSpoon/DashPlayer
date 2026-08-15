import { DpTask, DpTaskUpdate } from '@/common/contracts/dp-task';
import { Cancelable } from '@/common/interfaces';

/**
 * 后台任务业务服务。
 */
export default interface DpTaskService {
    detail(id: number): Promise<DpTask | null>;

    details(ids: number[]): Promise<Map<number, DpTask>>;

    create(): Promise<number>;

    update(task: DpTaskUpdate): void;

    process(id: number, info: DpTaskUpdate): void;

    finish(id: number, info: DpTaskUpdate): void;

    fail(id: number, info: DpTaskUpdate): void;

    cancel(id: number): void;

    checkCancel(id: number): void;

    registerTask(taskId: number, process: Cancelable): void;
}
