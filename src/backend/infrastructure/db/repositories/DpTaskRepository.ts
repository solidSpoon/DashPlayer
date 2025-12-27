import { DpTask, InsertDpTask } from '@/backend/infrastructure/db/tables/dpTask';

export type CreateDpTaskParams = Pick<InsertDpTask, 'status' | 'progress' | 'result'>;

export type DpTaskUpdatePatch = Partial<Pick<InsertDpTask, 'status' | 'progress' | 'result' | 'updated_at'>>;

export default interface DpTaskRepository {
    findById(id: number): Promise<DpTask | null>;
    create(params: CreateDpTaskParams): Promise<DpTask>;
    updateById(id: number, patch: DpTaskUpdatePatch): Promise<void>;
    cancelAllActive(): Promise<void>;
}
