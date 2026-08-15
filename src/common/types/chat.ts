import { ModelMessage } from 'ai';
import { AiUnifiedAnalysisRes } from '@/common/types/aiRes/AiUnifiedAnalysisRes';

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
};

export type ChatStartParams = {
    sessionId: string;
    messages: ModelMessage[];
    background?: ChatBackgroundContext;
};

export type ChatStartResult = {
    messageId: string;
};

export type ChatWelcomeParams = {
    sessionId: string;
    originalTopic: string;
    fullText?: string;
};

export type ChatStreamEvent = {
    sessionId: string;
    messageId: string;
    event: 'start' | 'chunk' | 'done' | 'error';
    chunk?: string;
    error?: string;
};
