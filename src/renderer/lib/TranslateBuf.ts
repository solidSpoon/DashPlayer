import SentenceT from './param/SentenceT';
import { sleep } from '../../utils/Util';
import { SentenceApiParam, toSentenceApiParam } from '../../types/TransApi';

const api = window.electron;
class TranslateBuf {
    startIndex: number;

    sentences: SentenceApiParam[];

    response: string[] | undefined;

    private size: number;

    private readonly capacity: number;

    next: TranslateBuf | undefined;

    constructor(startIndex: number, capacity: number) {
        this.startIndex = startIndex;
        this.sentences = [];
        this.size = 0;
        this.capacity = capacity;
        this.next = undefined;
    }

    canAdd(str: string): boolean {
        const b = this.size + str.length < this.capacity;
        if (!b) {
            if (this.size === 0) {
                throw new Error(
                    `translate buf: capacity too small-${str.length}`
                );
            }
        }
        return b;
    }

    add(sentence: SentenceT): void {
        if (!this.canAdd(sentence.text ?? '')) {
            throw new Error('translate buf: too large');
        }
        const s = {
            index: sentence.index,
            text: sentence.text ?? '',
            translate: undefined,
        };
        this.sentences.push(s);
        this.size += (sentence.text ?? '').length;
    }

    isEmpty(): boolean {
        return this.size === 0;
    }
}
const splitToBuffers = (
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
        buffer.add(item);
    });
    buffers.push(buffer);
    return buffers;
};
function merge(baseArr: SentenceT[], diff: SentenceApiParam[]) {
    const mapping = new Map<number, string>();
    diff.forEach((item) => {
        mapping.set(item.index, item.translate ?? '');
    });
    return baseArr.map((item) => {
        const translate = mapping.get(item.index);
        if (translate) {
            const ns = item.clone();
            ns.msTranslate = translate;
            return ns;
        }
        return item;
    });
}
const translate = async (sentence: SentenceT[]): Promise<SentenceT[]> => {
    if (sentence.length === 0) {
        return [];
    }
    const params = sentence.map(toSentenceApiParam);
    const cacheRes = await api.loadTransCache(params);
    let res = merge(sentence, cacheRes);
    const remain = res.filter(
        (item) => item.msTranslate === '' || item.msTranslate === undefined
    );
    const buffers: TranslateBuf[] = splitToBuffers(remain, 1000);

    // eslint-disable-next-line no-restricted-syntax
    // for (const buffer of buffers) {
    for (let i = 0; i < buffers.length; i += 1) {
        const buffer = buffers[i];
        if (buffer.isEmpty()) {
            // eslint-disable-next-line no-continue
            continue;
        }
        // eslint-disable-next-line no-await-in-loop
        const currentDiff = await api.batchTranslate(buffer.sentences);
        res = merge(res, currentDiff);
        if (i < buffers.length - 1) {
            // eslint-disable-next-line no-await-in-loop
            await sleep(300);
        }
    }
    return res;
};

export default translate;
