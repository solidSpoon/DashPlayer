/**
 * 整句学习页的展示层视图模型。
 *
 * 说明：AI SDK 的消息片段在 useSentenceLearningChat 里一次性转换成这里定义的纯数据结构，
 * 页面组件只消费视图模型，不再关心工具调用协议，方便单独预览与迭代版式。
 */

/** 页面上一条对话消息里的一个块，按模型输出的先后顺序排列。 */
export type LearningMessageBlock =
    | { kind: 'text'; text: string }
    | {
        kind: 'search';
        /** 本轮的检索关键词。 */
        queries: string[];
        /** 命中的字幕行，可点击跳转。 */
        hits: { index: number; text: string }[];
        /** 命中总条数（可能大于返回的 hits 数量）。 */
        total: number;
        /** 是否仍在检索中。 */
        running: boolean;
    }
    | {
        kind: 'context';
        /** 已读取的字幕索引区间；未完成时为 null。 */
        range: { start: number; end: number } | null;
        /** 是否仍在读取中。 */
        running: boolean;
    }
    | { kind: 'error'; text: string };

/** 页面上一条对话消息。 */
export type LearningMessageView = {
    id: string;
    role: 'user' | 'assistant';
    blocks: LearningMessageBlock[];
};

/** 句子解析的生命周期状态。 */
export type AnalysisStatus = 'idle' | 'streaming' | 'done' | 'error';
