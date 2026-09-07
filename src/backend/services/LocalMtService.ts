import type { LocalMtStatus } from '@/common/contracts/local-mt';

/** 轻量翻译模型（专用 MT 引擎）安装、生命周期与推理的业务边界。 */
export default interface LocalMtService {
    /** 查询模型安装状态与下载进度，不加载推理会话。 */
    getStatus(): Promise<LocalMtStatus>;
    /** 下载模型全部依赖文件（可续传）；同一时间只允许一个安装任务。 */
    download(): Promise<void>;
    /** 取消当前下载并等待写入结束，保留已下载的部分。 */
    cancelDownload(): Promise<void>;
    /** 删除模型及未完成下载；推理进行中时拒绝删除。 */
    deleteModel(): Promise<void>;
    /**
     * 批量翻译英文字幕为简体中文；结果顺序与输入一致。
     *
     * @param texts 待翻译的英文字幕行。
     * @param signal 外部取消信号；批次开始前与结束后检查。
     */
    translateLines(texts: string[], signal?: AbortSignal): Promise<string[]>;
}
