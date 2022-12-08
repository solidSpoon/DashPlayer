import SentenceT from './param/SentenceT';
import TranslateBuf from './TranslateBuf';

export default class TransFiller {
    private readonly subtitles: Array<SentenceT>;

    private readonly reminder: () => void;

    constructor(subtitles: Array<SentenceT>, reminder: () => void) {
        this.subtitles = subtitles || [];
        this.reminder = reminder;
    }

    /**
     * 字幕转化为 buffer
     * @param subtitles 字幕行数组
     * @param capacity 批处理块容量
     * @private
     */
    public static splitToBuffers = (
        subtitles: SentenceT[],
        capacity: number
    ): TranslateBuf[] => {
        const buffers: TranslateBuf[] = [];
        let buffer = new TranslateBuf(0, capacity);
        subtitles.forEach((item, index) => {
            item.text = item.text ? item.text : '';
            if (!buffer.canAdd(item.text)) {
                buffers.push(buffer);
                buffer = new TranslateBuf(index, capacity);
            }
            buffer.add(item.text);
        });
        buffers.push(buffer);
        return buffers;
    };

    public static sleep = (ms: number): Promise<void> => {
        return new Promise((resolve) => setTimeout(resolve, ms));
    };
}
