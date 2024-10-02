import { SentenceStruct } from '@/common/types/SentenceStruct';


export interface SrtSentence {
    fileHash: string;
    filePath: string;
    sentences: Sentence[];
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


    /**
     * 字幕机器翻译
     */
    msTranslate: string | null;

    key: string;

    /**
     * 批量翻译的分组, 从1开始
     */
    transGroup: number;

    struct: SentenceStruct;
}
