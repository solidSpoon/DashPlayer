import { eq, or } from 'drizzle-orm';
import { injectable } from 'inversify';

import db from '@/backend/infrastructure/db';
import { DpTask, dpTask, DpTaskState, InsertDpTask } from '@/backend/infrastructure/db/tables/dpTask';
import TimeUtil from '@/common/utils/TimeUtil';
import DpTaskRepository, { CreateDpTaskParams, DpTaskUpdatePatch } from '@/backend/application/ports/repositories/DpTaskRepository';

@injectable()
export default class DpTaskRepositoryImpl implements DpTaskRepository {

    public async findById(id: number): Promise<DpTask | null> {
        const rows: DpTask[] = await db
            .select()
            .from(dpTask)
            .where(eq(dpTask.id, id));
        return rows[0] ?? null;
    }

    public async create(params: CreateDpTaskParams): Promise<DpTask> {
        const rows: DpTask[] = await db
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
        return row;
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

