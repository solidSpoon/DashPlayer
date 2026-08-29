import { SentenceStruct } from '@/common/types/SentenceStruct';


export interface SrtSentence {
    fileHash: string;
    filePath: string;
    sentences: Sentence[];
    /** 为 true 时表示增量转录会话：句子坐标为分片大坐标，翻译结果仅存内存。 */
    transient?: boolean;
}

export interface Sentence {
    fileHash: string;
    index: number;

    start: number;

    end: number;

    adjustedStart: number | null;
    adjustedEnd: number | null;

    /**
     * 字幕英文原文
     */
    text: string;

    /**
     * 字幕中文原文
     */
    textZH: string;

    key: string;

    /**
     * 批量翻译的分组, 从1开始
     */
    transGroup: number;

    /**
     * 稳定句子翻译键，格式为 `fileHash:index`。
     * 说明：仅用于按句缓存和回写结果，不承载上下文语义。
     */
    translationKey: string;

    struct: SentenceStruct;
}
