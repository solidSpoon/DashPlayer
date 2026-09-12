import { UIMessageChunk } from 'ai';

/**
 * 创建整句学习会话所需的稳定上下文快照。
 */
export type ChatSessionCreateParams = {
    /** 当前视频 ID，用于在内存中按视频归组。 */
    videoId: string;
    /** 用户本次学习的原始文本。 */
    originalTopic: string;
    /** 创建会话时的周边字幕快照。 */
    paragraphLines: string[];
    /** 当前字幕缓存的 fileHash，用于 Agent 工具读取完整字幕。 */
    subtitleFileHash: string;
    /** 当前学习句在字幕缓存中的索引。 */
    anchorSentenceIndex: number;
};

/**
 * 后端创建的整句学习会话标识。
 */
export type ChatSessionCreateResult = {
    /** 后端生成的会话 ID。 */
    sessionId: string;
};

/**
 * 向已有会话追加一条用户消息并启动流式回答。
 */
export type ChatSendMessageParams = {
    sessionId: string;
    /** 新增的用户文本。 */
    content: string;
};

export type ChatSendMessageResult = {
    /** 后端为本次回答分配的 assistant 消息 ID。 */
    messageId: string;
};

/**
 * 关闭会话的命令参数。
 */
export type ChatSessionCloseParams = {
    /** 要关闭并取消未完成请求的会话 ID。 */
    sessionId: string;
};

/**
 * 取消会话当前运行但保留会话供后续继续对话的命令参数。
 */
export type ChatSessionStopParams = {
    /** 要取消当前运行的会话 ID。 */
    sessionId: string;
};

export type ChatStreamEvent = {
    /** 接收标准流片段的会话 ID。 */
    sessionId: string;
    /** AI SDK 标准 UI 消息流片段。 */
    chunk: UIMessageChunk;
};

/**
 * 完整句补全请求参数：当前字幕行及前后紧邻字幕行。
 */
export type CompleteSentenceParams = {
    /** 当前字幕行原文。 */
    text: string;
    /** 当前行之前紧邻的字幕行（时间升序，最近一行在最后）。 */
    precedingLines: string[];
    /** 当前行之后紧邻的字幕行（时间升序）。 */
    followingLines: string[];
};

/**
 * 完整句补全结果。
 */
export type CompleteSentenceResult = {
    /** 给定字幕行本身是否已是一个完整句子。 */
    complete: boolean;
    /** 补全后的完整句子原文；已完整时与原行一致。 */
    sentence: string;
    /** 完整句的中文译文，学习页展示在句子下方。 */
    translation: string;
};
