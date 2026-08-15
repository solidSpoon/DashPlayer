import {
    TranscriptTask,
    TranscriptTaskResult,
    TranscriptTaskState,
} from '@/common/contracts/transcript/transcript-task';

/**
 * 新建转录任务的输入。
 */
export type CreateTranscriptionTaskParams = {
    /** 待转录媒体的绝对路径，也是唯一去重键。 */
    filePath: string;
};

/**
 * 转录任务状态更新内容。
 */
export type TranscriptionTaskUpdatePatch = {
    /** 新状态。 */
    status: TranscriptTaskState;
    /** 状态对应的展示结果。 */
    result?: TranscriptTaskResult;
};

/**
 * 转录任务持久化端口。
 */
export default interface TranscriptionTaskRepository {
    /** 查询全部转录任务。 */
    list(): Promise<TranscriptTask[]>;
    /** 按媒体路径查询任务。 */
    findByFilePath(filePath: string): Promise<TranscriptTask | null>;
    /** 插入任务；路径重复时返回已有任务。 */
    createIfAbsent(params: CreateTranscriptionTaskParams): Promise<TranscriptTask>;
    /** 更新指定任务的状态和结果。 */
    updateByFilePath(filePath: string, patch: TranscriptionTaskUpdatePatch): Promise<void>;
    /** 删除指定任务。 */
    deleteByFilePath(filePath: string): Promise<void>;
    /** 将重启前遗留的活动任务标记为中断。 */
    markActiveAsInterrupted(): Promise<void>;
}
