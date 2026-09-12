import { backendClient } from '@/fronted/infrastructure/electron/backendClient';
import {
    ChatSessionCreateParams,
    ChatSendMessageParams,
    CompleteSentenceParams,
    CompleteSentenceResult,
} from '@/common/types/chat';
import { AnalysisStartParams, AnalysisStartResult } from '@/common/types/analysis';

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
     * 向会话发送一条用户消息并启动流式回答。
     *
     * @param params 会话 ID 与用户文本。
     * @returns 后端为本次回答分配的消息标识。
     */
    sendMessage: (params: ChatSendMessageParams) => backendClient.call('chat/send-message', params),

    /**
     * 启动当前会话主题的结构化分析（懒加载，用户点击解析入口时触发）。
     *
     * @param params 会话 ID。
     * @returns 本次分析消息 ID。
     */
    startAnalysis: (params: AnalysisStartParams): Promise<AnalysisStartResult> =>
        backendClient.call('chat/analysis/start', params),

    /**
     * 本地选词：返回句子里的生词与句内逐词释义。
     *
     * 说明：只读本地词典，不调用模型、不访问网络，因此可以在打开学习页时立即调用。
     *
     * @param text 目标句子原文。
     * @returns 生词列表与句内逐词释义映射。
     */
    pickSentenceVocabulary: (text: string) => backendClient.call('vocabulary/pick-sentence', { text }),

    /**
     * 补全被换行截断的字幕：仅云端整句学习启用时可用。
     *
     * @param params 当前字幕行及前后紧邻字幕行。
     * @returns 是否原本完整与补全后的完整句。
     */
    completeSentence: (params: CompleteSentenceParams): Promise<CompleteSentenceResult> =>
        backendClient.call('chat/complete-sentence', params),

    /**
     * 查询整句讲解当前是否可用（功能已启用且云端模型已配好）。
     *
     * 说明：学习页据此决定解析与对话入口是否置灰，避免用户点下去才发现用不了。
     *
     * @returns 可发起解析与对话时为 true。
     */
    learningAvailable: (): Promise<boolean> => backendClient.call('chat/learning/available'),
};
