import axios from "axios";
import SentenceT from "./param/SentenceT";

class TransFiller {
    private readonly subtitles: Array<SentenceT>;

    constructor(subtitles: Array<SentenceT>) {
        this.subtitles = subtitles ? subtitles : [];
    }

    /**
     * 填充翻译
     */
    public fillTranslate(): void {
        const buffers = this.splitToBuffers(this.subtitles, 1000);
        this.batchTranslate(buffers, 300).finally();
    }

    /**
     * 字幕转化为 buffer
     * @param subtitles 字幕行数组
     * @param capacity 批处理块容量
     * @private
     */
    private splitToBuffers(subtitles: SentenceT[], capacity: number): Buf[] {
        const buffers: Buf[] = [];
        let buffer = new Buf(0, capacity);
        subtitles.forEach((item, index) => {
            item.text = item.text ? item.text : '';
            if (!buffer.canAdd(item.text)) {
                buffers.push(buffer);
                buffer = new Buf(index, capacity);
            }
            buffer.add(item.text);
        })
        buffers.push(buffer);
        return buffers;
    }

    /**
     * 批量翻译
     * @param buffers Buf[]
     * @param delay 每次翻译的间隔时间
     * @private
     */
    private async batchTranslate(buffers: Buf[], delay: number): Promise<void> {
        for (let buffer of buffers) {
            if (buffer.isEmpty()) {
                return;
            }
            const data = {
                str: buffer.strs
            }
            const response = await axios.post('/api/translate', data);
            this.processTransResponse(response, buffer.startIndex);
            await this.sleep(delay);
        }
    }

    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }


    processTransResponse(response, start: number): void {
        if (response["data"]["success"] === false) {
            return;
        }
        response["data"]["strs"].forEach((item, i) => {
            const index = start + i;
            this.subtitles[index]["msTranslate"] = item;
        })
    }

}

class Buf {
    startIndex: number;
    strs: string[];
    private size: number;
    private readonly capacity: number;
    next: Buf;

    constructor(startIndex, capacity: number) {
        this.startIndex = startIndex;
        this.strs = [];
        this.size = 0;
        this.capacity = capacity;
        this.next = undefined;
    }

    canAdd(str: string): boolean {
        const b = this.size + str.length < this.capacity;
        if (!b) {
            if (this.size === 0) {
                throw 'translate buf: capacity too small-' + str.length;
            }
        }
        return b;
    }

    add(str: string): void {
        if (!this.canAdd(str)) {
            throw 'translate buf: too large';
        }
        this.strs.push(str);
        this.size += str.length;
    }

    isEmpty(): boolean {
        return this.size === 0;
    }
}


export default TransFiller;