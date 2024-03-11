import hash from '../utils/hash';

class SentenceT {
    public index: number;

    public currentBegin: number | undefined;

    public currentEnd: number | undefined;

    public originalBegin: number | undefined;

    public originalEnd: number | undefined;

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

    public key = '';

    /**
     * 批量翻译的分组, 从1开始
     */
    public transGroup = 0;

    /**
     * 展示在界面的分组
     */
    public displayGroup = 0;

    public getKey = (): string => {
        return this.key;
    };

    public equals(other: SentenceT | undefined): boolean {
        if (other === undefined) {
            return false;
        }
        return this.getKey() === other.getKey();
    }

    public setKey(): void {
        const source = `${this.fileUrl ?? ''}:${(this.index ?? 0).toString()}`;
        this.key = hash(source);
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

    public isCurrentStrict = (time: number): boolean => {
        if (this.currentBegin === undefined || this.currentEnd === undefined) {
            return false;
        }
        return time >= this.currentBegin && time <= this.currentEnd;
    };

    constructor(index: number) {
        this.index = index;
    }

    public clone(): SentenceT {
        const result = new SentenceT(this.index);
        result.currentBegin = this.currentBegin;
        result.currentEnd = this.currentEnd;
        result.nextBegin = this.nextBegin;
        result.text = this.text;
        result.textZH = this.textZH;
        result.fileUrl = this.fileUrl;
        result.msTranslate = this.msTranslate;
        result.key = this.key;
        result.transGroup = this.transGroup;
        result.displayGroup = this.displayGroup;
        result.originalBegin = this.originalBegin;
        result.originalEnd = this.originalEnd;
        return result;
    }
}

export default SentenceT;
