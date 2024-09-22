import { eq, or } from 'drizzle-orm';
import db from '@/backend/db/db';
import { DpTask, dpTask, DpTaskState, InsertDpTask } from '@/backend/db/tables/dpTask';

import LRUCache from 'lru-cache';
import TimeUtil from '@/common/utils/TimeUtil';
import ErrorConstants from '@/common/constants/error-constants';
import { injectable, postConstruct } from 'inversify';
import DpTaskService from '@/backend/services/DpTaskService';


const cache: LRUCache<number, InsertDpTask> = new LRUCache({
    maxSize: 2000,
    sizeCalculation: (value, key) => {
        return 1;
    }
});

@injectable()
export default class DpTaskServiceImpl implements DpTaskService {

    public upQueue: Map<number, InsertDpTask> = new Map();
    public cancelQueue: Set<number> = new Set();


    public async detail(id: number): Promise<DpTask | undefined> {

        if (cache.has(id)) {
            console.log('temp task');
            return cache.get(id) as DpTask;
        }

        const tasks: DpTask[] = await db
            .select()
            .from(dpTask)
            .where(eq(dpTask.id, id));

        if (tasks.length === 0) {
            return undefined;
        }
        return tasks[0];
    }

    public async details(ids: number[]): Promise<Map<number, DpTask>> {
        const map = new Map<number, DpTask>();
        await Promise.all(ids.map(async id => {
                const task = await this.detail(id);
                if (task) {
                    map.set(id, task);
                }
            }
        ));
        return map;
    }


    public async create(): Promise<number> {
        const task: DpTask[] = await db
            .insert(dpTask)
            .values({
                status: DpTaskState.INIT,
                progress: '任务创建成功'
            }).returning();
        const taskId = task[0].id;
        cache.set(taskId, {
            id: taskId,
            status: DpTaskState.INIT,
            progress: '任务创建成功',
            created_at: TimeUtil.timeUtc(),
            updated_at: TimeUtil.timeUtc()
        });
        return taskId;
    }


    public update(
        task: InsertDpTask
    ) {
        if (task.id === undefined || task.id === null) {
            return;
        }
        if (cache.has(task.id)) {
            cache.set(task.id, {
                ...cache.get(task.id),
                ...task,
                updated_at: TimeUtil.timeUtc()
            });
        }
        this.upQueue.set(task.id, {
            ...task,
            updated_at: TimeUtil.timeUtc()
        });
    }

    public process(id: number, info: InsertDpTask) {
        const task: InsertDpTask = {
            id,
            status: DpTaskState.IN_PROGRESS,
        };
        this.updateTaskInfo(task, info);
        this.update(task);
    }

    public finish(id: number, info: InsertDpTask) {
        const task:InsertDpTask = {
            id,
            status: DpTaskState.DONE,
        };
        this.updateTaskInfo(task, info);
        this.update(task);
    }

    public fail(id: number, info: InsertDpTask) {
        const task:InsertDpTask = {
            id,
            status: DpTaskState.FAILED,
        };
        this.updateTaskInfo(task, info);
        this.update(task);
    }

    private updateTaskInfo(task: InsertDpTask, info: InsertDpTask) {
        if (info.progress !== undefined) {
            task.progress = info.progress;
        }
        if (info.result !== undefined) {
            task.result = info.result;
        }
    }

    cancel(id: number) {
        this.cancelQueue.add(id);
    }

    checkCancel(id: number) {
        if (this.cancelQueue.has(id)) {
            this.update({
                id,
                status: DpTaskState.CANCELLED,
                progress: '任务取消'
            });
            throw new Error(ErrorConstants.CANCEL_MSG);
        }
    }

    public async cancelAll() {
        await DpTaskServiceImpl.cancelAll();
    }

    @postConstruct()
    public postConstruct() {
        setInterval(async () => {
            if (this.upQueue.size > 0) {
                for (const [key, value] of this.upQueue) {
                    await db
                        .update(dpTask)
                        .set({
                            ...value,
                            updated_at: TimeUtil.timeUtc()
                        })
                        .where(eq(dpTask.id, key));
                    this.upQueue.delete(key);
                }
            }
        }, 3000);
    }

    public static async cancelAll() {
        await db
            .update(dpTask)
            .set({
                status: DpTaskState.CANCELLED,
                progress: '任务取消',
                updated_at: TimeUtil.timeUtc()
            })
            .where(or(eq(dpTask.status, DpTaskState.INIT), eq(dpTask.status, DpTaskState.IN_PROGRESS)));
    }
}
