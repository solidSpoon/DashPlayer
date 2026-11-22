import { backendClient } from '@/fronted/infrastructure/electron/backendClient';
import type {
    PiDownloadSessionDetailVO,
    PiDownloadSessionVO,
} from '@/common/contracts/pi-download';

/**
 * Pi 下载功能前端 IPC 封装。
 */
export const downloadApi = {
    /** 启动新的 Pi 下载会话并返回初始完整详情（含系统提示词与首条用户消息）。 */
    start: (url: string, outputDir?: string): Promise<PiDownloadSessionDetailVO> =>
        backendClient.call('pi-download/start', { url, outputDir }),

    /** 选择本次下载的本地保存目录。 */
    selectFolder: (): Promise<string[] | null> =>
        backendClient.call('system/select-folder', { createDirectory: true }),

    /** 向运行中或空闲的 Pi 下载会话发送后续指令。 */
    sendMessage: (sessionId: string, message: string): Promise<void> =>
        backendClient.call('pi-download/send-message', { sessionId, message }),

    /** 中止指定下载会话当前回合。 */
    abort: (sessionId: string): Promise<void> =>
        backendClient.call('pi-download/abort', { sessionId }),

    /** 关闭并销毁指定下载会话。 */
    close: (sessionId: string): Promise<void> =>
        backendClient.call('pi-download/close', { sessionId }),

    /** 查询所有会话列表（含持久化历史会话）。 */
    listSessions: (): Promise<PiDownloadSessionVO[]> =>
        backendClient.call('pi-download/list-sessions'),

    /** 获取指定会话完整详情（含历史对话时间线）。 */
    getSession: (sessionId: string): Promise<PiDownloadSessionDetailVO | null> =>
        backendClient.call('pi-download/get-session', { sessionId }),

    /** 删除指定历史会话记录。 */
    deleteSession: (sessionId: string): Promise<void> =>
        backendClient.call('pi-download/delete-session', { sessionId }),

    /** 获取下载工作台上下文（最终输出目录等）。 */
    getContext: (): Promise<{ videosDir: string }> =>
        backendClient.call('pi-download/context'),
};
