import { SentenceStruct } from '@/common/types/SentenceStruct';
import { Cloneable } from '@/common/interfaces';


export interface SrtSentence {
    fileHash: string;
    filePath: string;
    sentences: Sentence[];
}

export interface Sentence {
    fileHash: string;
    index: number;
    indexInFile: number | null;

    start: number;

    end: number;

    adjustedStart: number | null;
    adjustedEnd: number | null;

    /**
     * 字幕英文原文
     */
    text: string | null;

    /**
     * 字幕中文原文
     */
    textZH: string | null;


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

class SentenceC implements Sentence , Cloneable {
    public fileHash: string;
    public index: number;
    public indexInFile: number | null;

    public start: number;

    public end: number;

    public adjustedStart: number | null;
    public adjustedEnd: number | null;

    /**
     * 字幕英文原文
     */
    public text: string | null;

    /**
     * 字幕中文原文
     */
    public textZH: string | null;


    /**
     * 字幕机器翻译
     */
    public msTranslate: string | null;

    /**
     * DB key
     */
    public key = '';

    /**
     * 批量翻译的分组, 从1开始
     */
    public transGroup = 0;

    struct: SentenceStruct;

    public getKey = (): string => {
        return this.key;
    };

    public static from(a: Sentence): SentenceC {
        const result = new SentenceC(a.index);
        for (const key in a) {
            if (Object.prototype.hasOwnProperty.call(a, key)) {
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                result[key as keyof SentenceC] = a[key as keyof Sentence];
            }
        }
        return result;
    }


    constructor(index: number) {
        this.index = index;
    }

    public clone(): this {
        const result = new SentenceC(this.index) as this;
        for (const key in this) {
            if (Object.prototype.hasOwnProperty.call(this, key)) {
                // eslint-disable-next-line @typescript-eslint/ban-ts-comment
                // @ts-ignore
                result[key as keyof SentenceC] = this[key as keyof SentenceC];
            }
        }
        return result;
    }
}

export default SentenceC;
