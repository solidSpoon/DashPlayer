import SentenceT from './param/SentenceT';
import callApi from './apis/ApiWrapper';
import TranslateBuf from './TranslateBuf';

export default class TransFiller {
    private readonly subtitles: Array<SentenceT>;

    private readonly reminder: () => void;

    constructor(subtitles: Array<SentenceT>, reminder: () => void) {
        this.subtitles = subtitles || [];
        this.reminder = reminder;
    }

    /**
     * 填充翻译
     */
    public fillTranslate(): void {
        const buffers = this.splitToBuffers(this.subtitles, 1000);
        // eslint-disable-next-line promise/catch-or-return
        this.batchTranslate(buffers, 300).finally();
    }

    /**
     * 字幕转化为 buffer
     * @param subtitles 字幕行数组
     * @param capacity 批处理块容量
     * @private
     */
    private splitToBuffers = (
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

    /**
     * 批量翻译
     * @param buffers TranslateBuf[]
     * @param delay 每次翻译的间隔时间
     * @private
     */
    private async batchTranslate(
        buffers: TranslateBuf[],
        delay: number
    ): Promise<void> {
        // eslint-disable-next-line no-restricted-syntax
        for (const buffer of buffers) {
            if (buffer.isEmpty()) {
                return;
            }
            const data = {
                str: buffer.strs,
            };
            // eslint-disable-next-line no-await-in-loop
            const response = await callApi('batch-translate', [buffer.strs]);
            console.log('trans response', response);
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            this.processTransResponse(response, buffer.startIndex);
            // eslint-disable-next-line no-await-in-loop
            await this.sleep(delay);
        }
    }

    sleep = (ms: number): Promise<void> => {
        return new Promise((resolve) => setTimeout(resolve, ms));
    };

    processTransResponse(response: string[], start: number): void {
        // if (response["data"]["success"] === false) {
        //     return;
        // }
        response.forEach((item, i) => {
            const index = start + i;
            const sentenceT = this.subtitles[index];
            console.log('报错', sentenceT, index);
            sentenceT.msTranslate = item;
            if (sentenceT.isCurrent) {
                this.reminder();
            }
        });
    }
}
