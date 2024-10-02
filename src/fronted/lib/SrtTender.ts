import { Sentence } from '@/common/types/SentenceC';
import CollUtil from '@/common/utils/CollUtil';

interface TenderLine {
    index: number;
    t1: number;
    t2: number;
    opId: number;
    origin: Sentence;
}

export interface SrtTender {
    getByTime(time: number): Sentence;

    pin(sentence: Sentence): void;

    mapSeekTime(time: number | Sentence): { start: number, end: number };

    adjustBegin(sentence: Sentence, time: number): Sentence;

    adjustEnd(sentence: Sentence, time: number): Sentence;

    adjusted(sentence: Sentence, delta?: number): boolean;

    clearAdjust(sentence: Sentence): Sentence;

    timeDiff(sentence: Sentence): { start: number, end: number };

    update(sentence: Sentence): void;
}


class TenderUtils {
    public static sentenceKey(sentence: Sentence) {
        return `${sentence.fileHash}-${sentence.index}`;
    }
}


export class SrtTenderImpl implements SrtTender {
    private readonly MIN_DIFF = 0.5;
    private GROUP_SECONDS = 10;
    private MAX_OP_ID = 0;
    private lineBucket = new Map<number, TenderLine[]>();
    private readonly lines: TenderLine[] = [];
    private keyLineMapping = new Map<string, number>();
    private cacheIndex: number | null = null;
    private backupIndex = 0;

    constructor(sentences: Sentence[]) {
        if (CollUtil.isEmpty(sentences)) return;
        const tempLines = this.mapToLine(sentences);
        tempLines.forEach((item) => {
            this.put(item);
        });
        for (const l of this.lines) {
            this.keyLineMapping.set(TenderUtils.sentenceKey(l.origin), l.index);
        }
    }

    public getByTime(time: number): Sentence {
        return this.getByTimeInternal(time).origin;
    }

    public pin(sentence: Sentence) {
        const line = this.getByT(sentence);
        if (!line) return;
        this.put({ ...line });
    }

    public mapSeekTime(time: number | Sentence): { start: number, end: number } {
        const line = typeof time === 'number' ?
            this.getByTimeInternal(time) :
            this.getByT(time);
        if (!line) {
            return {
                start: 0,
                end: 0
            };
        }
        return {
            start: line.t1,
            end: line.t2
        };
    }

    public adjustBegin(sentence: Sentence, time: number): Sentence {
        const line = this.getByT(sentence);
        if (!line) return sentence;
        const clone = { ...sentence };
        this.put({
            ...line,
            t1: line.t1 + time,
            origin: clone
        });
        return clone;
    }

    public adjustEnd(sentence: Sentence, time: number): Sentence {
        const line = this.getByT(sentence);
        if (!line) return sentence;
        const clone = { ...sentence };
        this.put({
            ...line,
            t2: line.t2 + time,
            origin: clone
        });
        return clone;
    }

    public adjusted(sentence: Sentence, delta = 0.05): boolean {
        const line = this.getByT(sentence);
        if (!line) return false;
        const origin = line.origin;
        return Math.abs(line.t1 - origin.start) > delta || Math.abs(line.t2 - origin.end) > delta;
    }

    public clearAdjust(sentence: Sentence): Sentence {
        const line = this.getByT(sentence);
        if (!line) return sentence;
        const clone = {...sentence};
        this.put({
            ...line,
            t1: line.origin.start,
            t2: line.origin.end,
            origin: clone
        });
        return clone;
    }

    public timeDiff(sentence: Sentence): { start: number, end: number } {
        const line = this.getByT(sentence);
        if (!line) return { start: 0, end: 0 };
        const origin = line.origin;
        return {
            start: line.t1 - origin.start,
            end: line.t2 - origin.end
        };
    }

    public update(sentence: Sentence) {
        const line = this.getByT(sentence);
        if (!line) return;
        this.put({
            ...line,
            origin: sentence
        });
    }

    private getByT(sentence: Sentence): TenderLine | null {
        const index = this.keyLineMapping.get(TenderUtils.sentenceKey(sentence));
        if (index === undefined) {
            console.error('can not find sentence', sentence);
            return null;
        }
        return this.lines[index];
    }

    private isCurrent(line: TenderLine, time: number) {
        const start = Math.min(line.t1, line.t2, this.nextStart(line));
        const end = Math.max(line.t1, line.t2, this.nextStart(line));
        return time >= start && time <= end;
    }

    private put(item: TenderLine) {
        const tempItem = {
            ...this.orderTime(item),
            opId: this.MAX_OP_ID++
        };
        this.deleteInBucket(tempItem.index);
        this.addInBucket(tempItem);
        this.cacheIndex = null;
    }

    private addInBucket(tempItem: TenderLine) {
        this.lines[tempItem.index] = tempItem;
        const [minIndex, maxIndex] = this.mapIndex(tempItem);
        for (let i = minIndex; i <= maxIndex; i += 1) {
            const group = this.lineBucket.get(i) ?? [];
            group.push(tempItem);
            // opId 越大越靠前
            group.sort((a, b) => b.opId - a.opId);
            this.lineBucket.set(i, group);
        }
    }

    private deleteInBucket(index: number) {
        const item = this.lines[index];
        if (!item) return;
        const [minIndex, maxIndex] = this.mapIndex(item);
        for (let i = minIndex; i <= maxIndex; i += 1) {
            const group = this.lineBucket.get(i) ?? [];
            const idx = group.findIndex((item) => item.index === index);
            if (idx !== -1) {
                group.splice(idx, 1);
            }
            this.lineBucket.set(i, group);
        }
    }

    private mapIndex(item: TenderLine) {
        let minIndex = Math.floor(Math.min(this.start(item), this.nextStart(item)) / this.GROUP_SECONDS);
        if (item.index === 0) {
            minIndex = 0;
        }
        const maxIndex = Math.floor(Math.max(this.end(item), this.nextStart(item)) / this.GROUP_SECONDS);
        return [minIndex, maxIndex];
    }

    public nextStart(line: TenderLine): number {
        const nextIndex = Math.min(line.index + 1, this.lines.length - 1);
        return this.start(this.lines[nextIndex]);
    }

    public start(line: TenderLine): number {
        return Math.min(line.t1, line.t2);
    }

    public end(line: TenderLine): number {
        return Math.max(line.t1, line.t2);
    }

    private mapToLine(sentences: Sentence[]): TenderLine[] {
        let index = 0;
        return sentences.map((sentence) => ({
                index: index++,
                t1: [sentence.adjustedStart, sentence.start].find((item) => item !== null) ?? 0,
                t2: [sentence.adjustedEnd, sentence.end].find((item) => item !== null) ?? 0,
                opId: 0,
                origin: sentence
            })
        );
    }

    private orderTime(line: TenderLine) {
        if (line.t1 <= line.t2) {
            return line;
        }
        return {
            ...line,
            t1: line.t2,
            t2: line.t1
        };
    }

    private getByTimeInternal(time: number) {
        if (this.cacheIndex !== null) {
            const line = this.lines[this.cacheIndex];
            if (this.isCurrent(line, time)) {
                this.cacheIndex = line.index;
                this.backupIndex = line.index;
                return line;
            }
        }
        const index = Math.floor(time / this.GROUP_SECONDS);
        const group = this.lineBucket.get(index) ?? [];
        for (const line of group) {
            if (this.isCurrent(line, time)) {
                this.cacheIndex = line.index;
                this.backupIndex = line.index;
                return line;
            }
        }
        return this.lines[this.backupIndex];
    }
}
