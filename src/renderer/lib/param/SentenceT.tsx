// eslint-disable-next-line import/no-cycle
import { randomUUID } from 'crypto';

class SentenceT {
    id: string;

    key: string | undefined;

    isCurrent: boolean;

    /**
     * 字幕序号
     */
    sn: string | undefined;

    timeStart: number | undefined;

    timeEnd: number | undefined;

    /**
     * 字幕英文原文
     */
    text: string | undefined;

    /**
     * 字幕中文原文
     */
    textZH: string | undefined;

    /**
     * 字幕机器翻译
     */
    fileUrl: string | undefined;

    msTranslate: string | undefined;

    nextItem: SentenceT | undefined;

    prevItem: SentenceT | undefined;

    public getPrevItem = (): SentenceT => {
        return this.prevItem as SentenceT;
    };

    public getNestItem = (): SentenceT => {
        return this.nextItem as SentenceT;
    };

    divElement: React.RefObject<HTMLDivElement> | undefined;

    constructor() {
        this.id = randomUUID();
        this.isCurrent = false;
    }
}

export default SentenceT;
