import { CoreMessage } from 'ai';

export type ChatStartParams = {
    sessionId: string;
    messages: CoreMessage[];
};

export type ChatStartResult = {
    messageId: string;
};

export type ChatWelcomeParams = {
    originalTopic: string;
    fullText?: string;
};

export type ChatWelcomeResult = {
    display: string;
    context: string;
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
