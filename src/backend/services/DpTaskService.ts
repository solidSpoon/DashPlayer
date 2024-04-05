
import { eq } from 'drizzle-orm';
import db from '@/backend/db/db';
import { DpTask, dpTask, DpTaskState, InsertDpTask } from '@/backend/db/tables/dpTask';





export default class DpTaskService {

    public static async detail(
        id: number
    ): Promise<DpTask | undefined> {
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
        return task[0].id;
    }

    public static async update(
        task: InsertDpTask
    ) {
        await db
            .update(dpTask)
            .set(task)
            .where(eq(dpTask.id, task.id));
    }

    static cancel(id: number) {
        db
            .update(dpTask)
            .set({
                status: DpTaskState.CANCELLED,
                progress: '任务取消',
            })
            .where(eq(dpTask.id, id));
    }
}
