// eslint-disable-next-line import/no-cycle
import { randomUUID } from 'crypto';

class SentenceT {
    public index: number;

    public currentBegin: number | undefined;

    public currentEnd: number | undefined;

    public nextBegin: number | undefined;

    /**
     * 字幕英文原文
     */
    public text: string | undefined;

    /**
     * 字幕中文原文
     */
    public textZH: string | undefined;

    public fileUrl: string | undefined;

    /**
     * 字幕机器翻译
     */
    public msTranslate: string | undefined;

    public getKey = (): string => {
        return `${this.fileUrl ?? 'file-url'}<->${this.index}`;
    };

    public equals(other: SentenceT | undefined): boolean {
        if (other === undefined) {
            return false;
        }
        return this.getKey() === other.getKey();
    }

    public isCurrent = (time: number): boolean => {
        if (
            this.currentBegin === undefined ||
            this.currentEnd === undefined ||
            this.nextBegin === undefined
        ) {
            return false;
        }
        return time >= this.currentBegin - 0.2 && time <= this.nextBegin;
    };

    constructor(index: number) {
        this.index = index;
    }
}

export default SentenceT;
