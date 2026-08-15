import { DpTask, DpTaskState, DpTaskUpdate } from '@/common/contracts/dp-task';

/**
 * 创建后台任务时允许由业务层提供的字段。
 */
export type CreateDpTaskParams = Pick<DpTaskUpdate, 'status' | 'progress' | 'result'> & {
    status?: DpTaskState;
};

/**
 * 更新后台任务时允许写入的字段。
 */
export type DpTaskUpdatePatch = Pick<DpTaskUpdate, 'status' | 'progress' | 'result' | 'updated_at'>;

/**
 * 后台任务持久化端口。
 */
export default interface DpTaskRepository {
    findById(id: number): Promise<DpTask | null>;
    create(params: CreateDpTaskParams): Promise<DpTask>;
    updateById(id: number, patch: DpTaskUpdatePatch): Promise<void>;
    cancelAllActive(): Promise<void>;
}
