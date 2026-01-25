import { CoreMessage } from 'ai';
import { AiUnifiedAnalysisRes } from '@/common/types/aiRes/AiUnifiedAnalysisRes';

export type ChatBackgroundContext = {
    paragraphLines?: string[];
    analysis?: Partial<AiUnifiedAnalysisRes>;
};

export type ChatStartParams = {
    sessionId: string;
    messages: CoreMessage[];
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

export type ChatResetParams = {
    sessionId: string;
};

export type ChatStreamEvent = {
    sessionId: string;
    messageId: string;
    event: 'start' | 'chunk' | 'done' | 'error';
    chunk?: string;
    error?: string;
};
