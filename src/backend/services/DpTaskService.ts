import { DpTask, InsertDpTask } from '@/backend/db/tables/dpTask';
import { Cancelable } from '@/common/interfaces';


export default interface DpTaskService {
    detail(id: number): Promise<DpTask | null>;

    details(ids: number[]): Promise<Map<number, DpTask>>;

    create(): Promise<number>;

    update(task: InsertDpTask): void;

    process(id: number, info: InsertDpTask): void;

    finish(id: number, info: InsertDpTask): void;

    fail(id: number, info: InsertDpTask): void;

    cancel(id: number): void;

    checkCancel(id: number): void;

    cancelAll(): Promise<void>;

    registerTask(taskId: number, process: Cancelable): void;
}
