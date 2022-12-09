import hash from '../hash';

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

    public key: string = '';

    public getKey = (): string => {
        return this.key;
    };

    public equals(other: SentenceT | undefined): boolean {
        if (other === undefined) {
            return false;
        }
        return this.getKey() === other.getKey();
    }

    public updateKey(): void {
        const source = `${this.fileUrl ?? ''}:${(this.index ?? 0).toString()}:${
            this.msTranslate ?? ''
        }`;
        this.key = hash(source) + this.msTranslate;
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
        return result;
    }
}

export default SentenceT;
