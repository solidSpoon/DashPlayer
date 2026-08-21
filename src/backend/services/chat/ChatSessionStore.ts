import { randomUUID } from 'node:crypto';
import { injectable } from 'inversify';
import { ModelMessage } from 'ai';
import { AiUnifiedAnalysisRes } from '@/common/types/aiRes/AiUnifiedAnalysisRes';
import { ChatBackgroundContext, ChatSessionCreateParams } from '@/common/types/chat';

/**
 * 内存中的一次整句学习会话。
 */
export type ChatSession = {
    /** 后端生成的会话标识。 */
    id: string;
    /** 所属视频标识。 */
    videoId: string;
    /** 创建会话时选中的学习文本。 */
    originalTopic: string;
    /** 创建会话时冻结的周边字幕。 */
    paragraphLines: string[];
    /** 已完成并可用于后续请求的模型消息历史。 */
    messages: ModelMessage[];
    /** 已校验的最终句子分析结果。 */
    analysis?: AiUnifiedAnalysisRes;
    /** 当前会话是否已关闭。 */
    closed: boolean;
    /** 当前仍在执行的生成请求。 */
    runs: Map<string, AbortController>;
};

/**
 * 会话内存仓储契约，后续可在不改业务流程的前提下替换为数据库实现。
 */
export default interface ChatSessionStore {
    create(params: ChatSessionCreateParams): ChatSession;
    get(sessionId: string): ChatSession;
    appendMessage(sessionId: string, message: ModelMessage): void;
    setAnalysis(sessionId: string, analysis: AiUnifiedAnalysisRes): void;
    getBackground(sessionId: string): ChatBackgroundContext;
    startRun(sessionId: string, runId: string): AbortSignal;
    finishRun(sessionId: string, runId: string): void;
    stop(sessionId: string): void;
    close(sessionId: string): void;
}

/**
 * 使用 Map 保存视频分组、会话和运行状态的临时实现。
 */
@injectable()
export class InMemoryChatSessionStore implements ChatSessionStore {
    private readonly sessions = new Map<string, ChatSession>();
    private readonly sessionIdsByVideo = new Map<string, string[]>();

    /**
     * 创建新会话并把它加入对应视频的会话组。
     * @param params 创建时冻结的视频、主题和字幕上下文。
     * @returns 新创建的会话。
     */
    public create(params: ChatSessionCreateParams): ChatSession {
        const id = randomUUID();
        const session: ChatSession = {
            id,
            videoId: params.videoId,
            originalTopic: params.originalTopic,
            paragraphLines: [...params.paragraphLines],
            messages: [{
                role: 'user',
                content: `请帮我分析 "${params.originalTopic}"`,
            }],
            closed: false,
            runs: new Map(),
        };
        this.sessions.set(id, session);
        const videoSessionIds = this.sessionIdsByVideo.get(params.videoId) ?? [];
        this.sessionIdsByVideo.set(params.videoId, [...videoSessionIds, id]);
        return session;
    }

    /**
     * 读取仍存在的会话；找不到时立即暴露调用错误。
     * @param sessionId 会话 ID。
     * @returns 对应的内存会话。
     */
    public get(sessionId: string): ChatSession {
        const session = this.sessions.get(sessionId);
        if (!session) {
            throw new Error(`chat session not found: ${sessionId}`);
        }
        return session;
    }

    /**
     * 把一条已确认消息追加到会话历史。
     * @param sessionId 会话 ID。
     * @param message 要保存的模型消息。
     */
    public appendMessage(sessionId: string, message: ModelMessage): void {
        const session = this.getOpenSession(sessionId);
        session.messages.push(message);
    }

    /**
     * 保存通过 schema 校验的最终分析结果。
     * @param sessionId 会话 ID。
     * @param analysis 最终分析对象。
     */
    public setAnalysis(sessionId: string, analysis: AiUnifiedAnalysisRes): void {
        this.getOpenSession(sessionId).analysis = analysis;
    }

    /**
     * 构造后续聊天使用的冻结背景，不读取播放器的当前状态。
     * @param sessionId 会话 ID。
     * @returns 字幕与已完成分析组成的背景。
     */
    public getBackground(sessionId: string): ChatBackgroundContext {
        const session = this.getOpenSession(sessionId);
        return {
            paragraphLines: [...session.paragraphLines],
            analysis: session.analysis,
        };
    }

    /**
     * 为生成请求登记 AbortController，同一会话关闭时会统一取消。
     * @param sessionId 会话 ID。
     * @param runId 本次运行 ID。
     * @returns 传给 AI SDK 的取消信号。
     */
    public startRun(sessionId: string, runId: string): AbortSignal {
        const session = this.getOpenSession(sessionId);
        const controller = new AbortController();
        session.runs.set(runId, controller);
        return controller.signal;
    }

    /**
     * 清理已经结束的运行，避免长期持有 AbortController。
     * @param sessionId 会话 ID。
     * @param runId 本次运行 ID。
     */
    public finishRun(sessionId: string, runId: string): void {
        this.get(sessionId).runs.delete(runId);
    }

    /**
     * 取消会话内正在执行的请求，但允许后续继续发送消息。
     * @param sessionId 会话 ID。
     */
    public stop(sessionId: string): void {
        const session = this.getOpenSession(sessionId);
        for (const controller of session.runs.values()) {
            controller.abort('chat run stopped');
        }
        session.runs.clear();
    }

    /**
     * 关闭会话并取消其中全部未完成请求；历史仍保留在内存中供后续查看。
     * @param sessionId 会话 ID。
     */
    public close(sessionId: string): void {
        const session = this.get(sessionId);
        if (session.closed) {
            return;
        }
        session.closed = true;
        for (const controller of session.runs.values()) {
            controller.abort('chat session closed');
        }
        session.runs.clear();
    }

    /**
     * 读取可继续写入的会话，关闭后的会话不允许继续生成内容。
     * @param sessionId 会话 ID。
     * @returns 仍处于打开状态的会话。
     */
    private getOpenSession(sessionId: string): ChatSession {
        const session = this.get(sessionId);
        if (session.closed) {
            throw new Error(`chat session is closed: ${sessionId}`);
        }
        return session;
    }
}
