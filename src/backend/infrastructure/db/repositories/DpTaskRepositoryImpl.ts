import { eq, or } from 'drizzle-orm';
import { injectable } from 'inversify';

import db from '@/backend/infrastructure/db';
import { dpTask, DpTask as DpTaskRow, DpTaskState, InsertDpTask } from '@/backend/infrastructure/db/tables/dpTask';
import { DpTask } from '@/common/contracts/dp-task';
import TimeUtil from '@/common/utils/TimeUtil';
import DpTaskRepository, { CreateDpTaskParams, DpTaskUpdatePatch } from '@/backend/services/repositories/DpTaskRepository';

@injectable()
export default class DpTaskRepositoryImpl implements DpTaskRepository {

    /**
     * 将数据库行转换为业务任务，并拒绝未知状态。
     *
     * @param row Drizzle 查询返回的数据库行。
     * @returns 可跨层传递的后台任务。
     * @throws 数据库中的状态不属于已知任务状态时抛出。
     */
    private mapRow(row: DpTaskRow): DpTask {
        switch (row.status) {
            case DpTaskState.INIT:
            case DpTaskState.IN_PROGRESS:
            case DpTaskState.DONE:
            case DpTaskState.CANCELLED:
            case DpTaskState.FAILED:
                return row as DpTask;
            default:
                throw new Error(`数据库中的后台任务状态无效: ${row.status}`);
        }
    }

    public async findById(id: number): Promise<DpTask | null> {
        const rows: DpTaskRow[] = await db
            .select()
            .from(dpTask)
            .where(eq(dpTask.id, id));
        return rows[0] ? this.mapRow(rows[0]) : null;
    }

    public async create(params: CreateDpTaskParams): Promise<DpTask> {
        const rows: DpTaskRow[] = await db
            .insert(dpTask)
            .values({
                status: params.status ?? DpTaskState.INIT,
                progress: params.progress ?? '任务创建成功',
                result: params.result ?? null,
            })
            .returning();

        const row = rows[0];
        if (!row) {
            throw new Error('create dp task failed');
        }
        return this.mapRow(row);
    }

    public async updateById(id: number, patch: DpTaskUpdatePatch): Promise<void> {
        await db
            .update(dpTask)
            .set({
                ...patch,
                updated_at: patch.updated_at ?? TimeUtil.timeUtc(),
            } satisfies Partial<InsertDpTask>)
            .where(eq(dpTask.id, id));
    }

    public async cancelAllActive(): Promise<void> {
        await db
            .update(dpTask)
            .set({
                status: DpTaskState.CANCELLED,
                progress: '任务取消',
                updated_at: TimeUtil.timeUtc(),
            })
            .where(or(eq(dpTask.status, DpTaskState.INIT), eq(dpTask.status, DpTaskState.IN_PROGRESS)));
    }
}
