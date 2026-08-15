import { backendClient } from '@/fronted/infrastructure/electron/backendClient';
import { AnalysisStartParams } from '@/common/types/analysis';
import { ChatStartParams, ChatWelcomeParams } from '@/common/types/chat';

/**
 * 聊天功能调用的后端接口。
 */
export const chatApi = {
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
     * 获取聊天欢迎信息。
     *
     * @param params 欢迎信息请求参数。
     * @returns 后端返回的欢迎信息。
     */
    getWelcome: (params: ChatWelcomeParams) => backendClient.call('chat/welcome', params),
};
