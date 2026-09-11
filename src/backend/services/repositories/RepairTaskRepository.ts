import {
    RepairTask,
    RepairTaskUpdatePatch,
} from '@/common/contracts/playback-repair';

/**
 * 新建修复记录所需的输入。
 */
export type CreateRepairTaskParams = {
    /** 待修复媒体的绝对路径，也是唯一去重键。 */
    filePath: string;
};

/**
 * 播放修复记录的持久化端口。
 *
 * 记录只描述「这个媒体修过什么、结果如何」，产物是否存在与能否播放一律由磁盘上的
 * 产物文件决定，因此读取方不得用这里的状态替代产物检查。
 */
export default interface RepairTaskRepository {
    /** 查询全部修复记录，按创建顺序返回。 */
    list(): Promise<RepairTask[]>;
    /** 按媒体路径查询记录。 */
    findByFilePath(filePath: string): Promise<RepairTask | null>;
    /** 插入记录；路径重复时返回已有记录。 */
    createIfAbsent(params: CreateRepairTaskParams): Promise<RepairTask>;
    /** 更新指定记录；记录已被删除时不报错。 */
    updateByFilePath(filePath: string, patch: RepairTaskUpdatePatch): Promise<void>;
    /** 删除指定记录。 */
    deleteByFilePath(filePath: string): Promise<void>;
    /** 将重启前遗留的进行中记录标记为已中断。 */
    markActiveAsInterrupted(): Promise<void>;
}
