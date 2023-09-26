import { SentenceApiParam } from '../hooks/useSubtitle';
import SentenceT from './param/SentenceT';

export default class TranslateBuf {
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
