import { AiUnifiedAnalysisRes } from '@/common/types/aiRes/AiUnifiedAnalysisRes';

export type DeepPartial<T> = T extends (infer U)[]
    ? Array<DeepPartial<U | undefined>>
    : T extends object
        ? { [K in keyof T]?: DeepPartial<T[K]> }
        : T;

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
    partial?: DeepPartial<AiUnifiedAnalysisRes>;
    error?: string;
};
