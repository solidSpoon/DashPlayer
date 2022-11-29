// eslint-disable-next-line import/no-cycle
import SideSentence from '../../components/SideSentence';

class SentenceT {
    key: string | undefined;

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

    element: React.RefObject<SideSentence> | undefined;

    public getPrevItem = (): SentenceT => {
        return this.prevItem as SentenceT;
    };

    public getNestItem = (): SentenceT => {
        return this.nextItem as SentenceT;
    };

    divElement: React.RefObject<HTMLDivElement> | undefined;
}

export default SentenceT;
