/**
 * 后台任务状态。
 */
export enum DpTaskState {
    INIT = 'init',
    IN_PROGRESS = 'in_progress',
    DONE = 'done',
    CANCELLED = 'cancelled',
    FAILED = 'failed',
}

/**
 * 跨进程传输的后台任务详情。
 */
export interface DpTask {
    /** 数据库任务编号。 */
    id: number;
    /** 当前任务状态。 */
    status: DpTaskState;
    /** 面向用户的进度描述。 */
    progress: string | null;
    /** 任务结果序列化文本。 */
    result: string | null;
    /** UTC 创建时间。 */
    created_at: string;
    /** UTC 更新时间。 */
    updated_at: string;
}

/**
 * 后端更新任务时使用的字段集合。
 */
export type DpTaskUpdate = Partial<DpTask>;
