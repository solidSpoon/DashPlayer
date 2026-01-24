import { AiUnifiedAnalysisRes } from '@/common/types/aiRes/AiUnifiedAnalysisRes';

export type AnalysisStartParams = {
    sessionId: string;
    text: string;
};

export type AnalysisStartResult = {
    messageId: string;
};

export type AnalysisStreamEvent = {
    sessionId: string;
    messageId: string;
    event: 'start' | 'chunk' | 'done' | 'error';
    partial?: Partial<AiUnifiedAnalysisRes>;
    error?: string;
};
