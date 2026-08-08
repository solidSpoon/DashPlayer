/**
 * 转录任务共享契约：后端渲染事件与前端队列共用，避免前后端各自定义导致漂移。
 */

/** 转录任务状态，取值与 db 的 DpTaskState 保持一致（兼容已持久化的队列数据）。 */
export enum TranscriptTaskState {
    INIT = 'init',
    IN_PROGRESS = 'in_progress',
    DONE = 'done',
    CANCELLED = 'cancelled',
    FAILED = 'failed',
}

/** 转录任务的展示结果，各字段按状态可选出现。 */
export interface TranscriptTaskResult {
    /** 面向用户的状态说明，如进度百分比与累计秒数。 */
    message?: string;
    /** 失败时的错误信息。 */
    error?: string;
    /** 完成后的字幕文件路径。 */
    srtPath?: string;
}

/** 后端向渲染进程推送的单条转录状态更新。 */
export interface TranscriptTaskUpdate {
    /** 被转录的媒体文件绝对路径。 */
    filePath: string;
    /** 任务标识；当前本地转录固定为 0。 */
    taskId: number | null;
    /** 任务状态。 */
    status?: TranscriptTaskState;
    /** 整体进度百分比。 */
    progress?: number;
    /** 状态对应的展示结果。 */
    result?: TranscriptTaskResult;
}

/** 前端转录队列中的任务条目。 */
export interface TranscriptTask {
    /** 被转录的媒体文件绝对路径。 */
    file: string;
    /** 任务状态；缺省表示尚未开始。 */
    status?: TranscriptTaskState;
    /** 最近一次状态对应的展示结果。 */
    result?: TranscriptTaskResult;
    /** 入队时间（ISO 字符串）。 */
    created_at?: string;
    /** 最近更新时间（ISO 字符串）。 */
    updated_at?: string;
}
