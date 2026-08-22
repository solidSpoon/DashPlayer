import { UIMessageChunk } from 'ai';

export type DeepPartial<T> = T extends (infer U)[]
    ? Array<DeepPartial<U | undefined>>
    : T extends object
        ? { [K in keyof T]?: DeepPartial<T[K]> }
        : T;

/** 启动一次句子结构化分析所需的会话标识。 */
export type AnalysisStartParams = {
    sessionId: string;
};

/** 后端为结构化分析流分配的消息标识。 */
export type AnalysisStartResult = {
    messageId: string;
};

/** 使用 AI SDK UIMessageChunk 语义传输结构化分析增量。 */
export type AnalysisStreamEvent = {
    sessionId: string;
    messageId: string;
    chunk: UIMessageChunk;
};
