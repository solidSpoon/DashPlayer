import { backendClient } from '@/fronted/infrastructure/electron/backendClient';
import { AnalysisStartParams } from '@/common/types/analysis';
import {
    ChatSessionCreateParams,
    ChatStartParams,
} from '@/common/types/chat';

/**
 * 聊天功能调用的后端接口。
 */
export const chatApi = {
    /**
     * 在 main 进程创建内存会话。
     *
     * @param params 会话创建快照。
     * @returns 后端生成的会话 ID。
     */
    createSession: (params: ChatSessionCreateParams) => backendClient.call('chat/session/create', params),

    /**
     * 关闭会话并取消全部未完成生成。
     *
     * @param sessionId 要关闭的会话 ID。
     * @returns 后端完成关闭后的 Promise。
     */
    closeSession: (sessionId: string) => backendClient.call('chat/session/close', { sessionId }),

    /**
     * 取消会话当前运行但保留历史。
     *
     * @param sessionId 要停止的会话 ID。
     * @returns 后端完成取消后的 Promise。
     */
    stopSession: (sessionId: string) => backendClient.call('chat/session/stop', { sessionId }),

    /**
     * 启动聊天消息流。
     *
     * @param params 聊天请求参数。
     * @returns 后端创建的消息标识。
     */
    start: (params: ChatStartParams) => backendClient.call('chat/start', params),

    /**
     * 启动聊天分析消息流。
     *
     * @param params 分析请求参数。
     * @returns 后端创建的消息标识。
     */
    startAnalysis: (params: AnalysisStartParams) => backendClient.call('chat/analysis/start', params),

    /**
     * 本地选词：返回句子里的生词与句内逐词释义。
     *
     * 说明：只读本地词典，不调用模型、不访问网络，因此可以在打开学习页时立即调用。
     *
     * @param text 目标句子原文。
     * @returns 生词列表与句内逐词释义映射。
     */
    pickSentenceVocabulary: (text: string) => backendClient.call('vocabulary/pick-sentence', { text }),
};
