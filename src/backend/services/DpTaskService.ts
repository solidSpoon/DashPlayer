import {eq} from 'drizzle-orm';
import db from '@/backend/db/db';
import {DpTask, dpTask, DpTaskState, InsertDpTask} from '@/backend/db/tables/dpTask';

import LRUCache from "lru-cache";


const cache: LRUCache<number, InsertDpTask> = new LRUCache({
    maxSize: 2000,
    sizeCalculation: (value, key) => {
        return 1
    },
})
export default class DpTaskService {
    public static upQueue: Map<number, InsertDpTask> = new Map();
    static {
        setInterval(async () => {
            if (this.upQueue.size > 0) {
                for (const [key, value] of this.upQueue) {
                    await db
                        .update(dpTask)
                        .set({
                            ...value,
                            updated_at: new Date().toISOString(),
                        })
                        .where(eq(dpTask.id, key));
                    this.upQueue.delete(key);
                }
            }
        }, 3000);
    }
    public static async detail(
        id: number
    ): Promise<DpTask | undefined> {

        if(cache.has(id)) {
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


    public static async create() {
        const task: DpTask[] = await db
            .insert(dpTask)
            .values({
                status: DpTaskState.INIT,
                progress: '任务创建成功',
            }).returning();
        const taskId = task[0].id;
        cache.set(taskId, {
            id: taskId,
            status: DpTaskState.INIT,
            progress: '任务创建成功',
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
        });
        return taskId;
    }

    public static async update(
        task: InsertDpTask
    ) {
        if (cache.has(task.id)) {
            cache.set(task.id, {
                ...cache.get(task.id),
                ...task,
                updated_at: new Date().toISOString()
            })
        }
        this.upQueue.set(task.id, {
            ...task,
            updated_at: new Date().toISOString(),
        });
    }

    static cancel(id: number) {
        if (cache.has(id)) {
            cache.set(id, {
                ...cache.get(id),
                status: DpTaskState.CANCELLED,
                progress: '任务取消',
                updated_at: new Date().toISOString()
            })
        }
        this.upQueue.set(id, {
            status: DpTaskState.CANCELLED,
            progress: '任务取消',
            updated_at: new Date().toISOString(),
        });
    }
}
