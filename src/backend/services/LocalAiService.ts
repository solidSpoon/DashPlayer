import type { LocalAiStatus } from '@/common/contracts/local-ai';

/** 本地模型安装、生命周期和结构化推理的业务边界。 */
export default interface LocalAiService {
    /** 查询安装状态和下载进度，不加载模型。 */
    getStatus(): Promise<LocalAiStatus>;
    /** 启动可续传下载；同一时间只允许一个安装任务。 */
    download(): Promise<void>;
    /** 取消下载并等待写入结束，保留已下载的部分。 */
    cancelDownload(): Promise<void>;
    /** 删除模型与未完成下载；使用中或下载中时拒绝删除。 */
    deleteModel(): Promise<void>;
    /** 按约束生成完整 JSON；取消、截断、非法输出时抛错。 */
    generate(prompt: string, schema: Record<string, unknown>, signal?: AbortSignal): Promise<unknown>;
    /** 中止下载、推理并等待子进程退出。 */
    shutdown(): Promise<void>;
}
