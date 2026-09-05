import type { LocalAiStatus } from '@/common/contracts/local-ai';

/** 本地模型安装、生命周期和结构化推理的业务边界。 */
export default interface LocalAiService {
    /** 查询全部目录模型的安装状态、下载进度、当前使用模型和运行时就绪情况，不加载模型。 */
    getStatus(): Promise<LocalAiStatus>;
    /** 读取全部本地功能共用的模型 id，并校验属于目录。 */
    getActiveModelId(): Promise<string>;
    /** 将全部本地功能切换到指定模型；下次推理时自动切换加载。 */
    setActiveModelId(modelId: string): Promise<void>;
    /** 下载指定模型（可续传）；同一时间只允许一个安装任务。 */
    download(modelId: string): Promise<void>;
    /** 取消当前下载并等待写入结束，保留已下载的部分。 */
    cancelDownload(): Promise<void>;
    /** 删除指定模型及未完成下载；使用中或下载中时拒绝删除。 */
    deleteModel(modelId: string): Promise<void>;
    /**
     * 使用指定模型按约束生成完整 JSON；取消、截断、非法输出时抛错。
     *
     * @param prompt 完整提示词。
     * @param schema 期望输出的 JSON Schema。
     * @param modelId 目录内的模型标识，必须显式指定，不做默认回退。
     * @param signal 外部取消信号。
     */
    generate(prompt: string, schema: Record<string, unknown>, modelId: string, signal?: AbortSignal): Promise<unknown>;
    /** 中止下载、推理并等待子进程退出。 */
    shutdown(): Promise<void>;
}
