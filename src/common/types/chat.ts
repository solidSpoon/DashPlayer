import { AiUnifiedAnalysisRes } from '@/common/types/aiRes/AiUnifiedAnalysisRes';
import { UIMessageChunk } from 'ai';

/**
 * 聊天主题，可以是纯文本，也可以是字幕中的字符范围。
 */
export type Topic = {
    /** 主题文本或字幕范围。 */
    content: string | {
        /** 范围起点。 */
        start: {
            /** 字幕索引。 */
            sIndex: number;
            /** 字幕内字符索引。 */
            cIndex: number;
        };
        /** 范围终点。 */
        end: {
            /** 字幕索引。 */
            sIndex: number;
            /** 字幕内字符索引。 */
            cIndex: number;
        };
    };
} | 'offscreen';

export type ChatBackgroundContext = {
    paragraphLines?: string[];
    analysis?: Partial<AiUnifiedAnalysisRes>;
    /** 当前会话字幕缓存的只读概览，不包含字幕正文。 */
    subtitleOverview?: {
        /** 字幕行数。 */
        lineCount: number;
        /** 所有字幕文本的字符数。 */
        characterCount: number;
        /** 字幕索引的最小值。 */
        minIndex: number;
        /** 字幕索引的最大值。 */
        maxIndex: number;
        /** 当前学习句的字幕索引。 */
        anchorIndex: number;
    };
};

/** 整句学习聊天可选的模型推理强度。 */
export type ChatReasoningEffort = 'low' | 'medium' | 'high';

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
 * 向已有会话追加一条用户消息。
 */
export type ChatStartParams = {
    sessionId: string;
    content: string;
    /** 本次回答使用的推理强度；未传时使用中档。 */
    reasoningEffort?: ChatReasoningEffort;
};

export type ChatStartResult = {
    messageId: string;
};

export type ChatWelcomeParams = {
    /** 已由 main 进程持有上下文的会话 ID。 */
    sessionId: string;
    /** 欢迎回答使用的推理强度；未传时使用中档。 */
    reasoningEffort?: ChatReasoningEffort;
};

/**
 * 关闭会话的命令参数。
 */
export type ChatSessionCloseParams = {
    /** 要关闭并取消未完成请求的会话 ID。 */
    sessionId: string;
};

/**
 * 暂停会话当前运行但保留会话历史的命令参数。
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
