import { Sentence } from '@/common/types/SentenceC';
import CollUtil from '@/common/utils/CollUtil';
import { ClipSrtLine } from '@/common/types/clipMeta';
import { getRendererLogger } from '@/fronted/log/simple-logger';

const logger = getRendererLogger('SrtTender');

interface TenderLine<T> {
    index: number;
    t1: number;
    t2: number;
    opId: number;
    origin: T;
}

export interface SrtTender<T> {
    getByTime(time: number): T;

    pin(sentence: T): void;

    mapSeekTime(time: number | T): { start: number, end: number };

    adjustBegin(sentence: T, time: number): T;

    adjustEnd(sentence: T, time: number): T;

    adjusted(sentence: T, delta?: number): boolean;

    clearAdjust(sentence: T): T;

    timeDiff(sentence: T): { start: number, end: number };

    update(sentence: T): void;
}


export abstract class AbstractSrtTender<T> implements SrtTender<T> {
    private GROUP_SECONDS = 10;
    private MAX_OP_ID = 0;
    private lineBucket = new Map<number, TenderLine<T>[]>();
    private readonly lines: TenderLine<T>[] = [];
    private keyLineMapping:Map<string, number> | null = null;
    private cacheIndex: number | null = null;
    private backupIndex = 0;

    public constructor(sentences: T[]) {
        if (CollUtil.isEmpty(sentences)) return;
        const tempLines = this.mapToLine(sentences);
        tempLines.forEach((item) => {
            this.put(item);
        });
    }

    private getKeyLineMapping() {
        if (this.keyLineMapping) return this.keyLineMapping;
        this.keyLineMapping = new Map();
        for (const l of this.lines) {
            this.keyLineMapping.set(this.getOriginKey(l.origin), l.index);
        }
        return this.keyLineMapping;
    }

    abstract getOriginStart(sentence: T): number;

    abstract getOriginEnd(sentence: T): number;

    abstract getOriginAdjustedStart(sentence: T): number | null;

    abstract getOriginAdjustedEnd(sentence: T): number | null;

    abstract getOriginKey(sentence: T): string;

    public getByTime(time: number): T {
        return this.getByTimeInternal(time).origin;
    }

    public pin(sentence: T) {
        const line = this.getByT(sentence);
        if (!line) return;
        this.put({ ...line });
    }

    public mapSeekTime(time: number | T): { start: number, end: number } {
        const line = typeof time === 'number' ?
            this.getByTimeInternal(time) :
            this.getByT(time);
        if (!line) {
            return {
                start: 0,
                end: 0
            };
        }
        logger.debug('Seek to internal', { t1: line.t1, origin: line.origin });
        return {
            start: line.t1,
            end: line.t2
        };
    }

    public adjustBegin(sentence: T, time: number): T {
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

    public adjustEnd(sentence: T, time: number): T {
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

    public adjusted(sentence: T, delta = 0.05): boolean {
        const line = this.getByT(sentence);
        if (!line) return false;
        const origin = line.origin;
        return Math.abs(line.t1 - this.getOriginStart(origin)) > delta || Math.abs(line.t2 - this.getOriginEnd(origin)) > delta;
    }

    public clearAdjust(sentence: T): T {
        const line = this.getByT(sentence);
        if (!line) return sentence;
        const clone = { ...sentence };
        this.put({
            ...line,
            t1: this.getOriginStart(line.origin),
            t2: this.getOriginEnd(line.origin),
            origin: clone
        });
        return clone;
    }

    public timeDiff(sentence: T): { start: number, end: number } {
        const line = this.getByT(sentence);
        if (!line) return { start: 0, end: 0 };
        const origin = line.origin;
        return {
            start: line.t1 - this.getOriginStart(origin),
            end: line.t2 - this.getOriginEnd(origin)
        };
    }

    public update(sentence: T) {
        const line = this.getByT(sentence);
        if (!line) return;
        this.put({
            ...line,
            origin: sentence
        });
    }

    private getByT(sentence: T): TenderLine<T> | null {
        const index = this.getKeyLineMapping().get(this.getOriginKey(sentence));
        if (index === undefined) {
            logger.error('Can not find sentence', { sentence, key: this.getOriginKey(sentence), mapping: this.getKeyLineMapping() });
            return null;
        }
        return this.lines[index];
    }

    private isCurrent(line: TenderLine<T>, time: number) {
        const start = Math.min(line.t1, line.t2, this.nextStart(line));
        const end = Math.max(line.t1, line.t2, this.nextStart(line));
        return time >= start && time <= end;
    }

    private put(item: TenderLine<T>) {
        const tempItem = {
            ...this.orderTime(item),
            opId: this.MAX_OP_ID++
        };
        this.deleteInBucket(tempItem.index);
        this.addInBucket(tempItem);
        this.cacheIndex = null;
    }

    private addInBucket(tempItem: TenderLine<T>) {
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

    private mapIndex(item: TenderLine<T>) {
        let minIndex = Math.floor(Math.min(this.start(item), this.nextStart(item)) / this.GROUP_SECONDS);
        if (item.index === 0) {
            minIndex = 0;
        }
        const maxIndex = Math.floor(Math.max(this.end(item), this.nextStart(item)) / this.GROUP_SECONDS);
        return [minIndex, maxIndex];
    }

    public nextStart(line: TenderLine<T>): number {
        const nextIndex = Math.min(line.index + 1, this.lines.length - 1);
        return this.start(this.lines[nextIndex]);
    }

    public start(line: TenderLine<T>): number {
        return Math.min(line.t1, line.t2);
    }

    public end(line: TenderLine<T>): number {
        return Math.max(line.t1, line.t2);
    }

    private mapToLine(sentences: T[]): TenderLine<T>[] {
        let index = 0;
        return sentences.map((sentence) => ({
                index: index++,
                t1: [this.getOriginAdjustedStart(sentence),
                    this.getOriginStart(sentence)].find((item) => item !== null) ?? 0,
                t2: [this.getOriginAdjustedEnd(sentence),
                    this.getOriginEnd(sentence)].find((item) => item !== null) ?? 0,
                opId: 0,
                origin: sentence
            })
        );
    }

    private orderTime(line: TenderLine<T>) {
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

export class SrtTenderImpl extends AbstractSrtTender<Sentence> {
    getOriginStart(sentence: Sentence): number {
        return sentence.start;
    }

    getOriginEnd(sentence: Sentence): number {
        return sentence.end;
    }

    getOriginAdjustedStart(sentence: Sentence): number | null {
        return sentence.adjustedStart;
    }

    getOriginAdjustedEnd(sentence: Sentence): number | null {
        return sentence.adjustedEnd;
    }

    getOriginKey(sentence: Sentence): string {
        return `${sentence.fileHash}-${sentence.index}`;
    }

}

export class ClipTenderImpl extends AbstractSrtTender<ClipSrtLine> {
    private readonly srtKey: string;
    constructor(sentences: ClipSrtLine[], key: string) {
        super(sentences);
        this.srtKey = key;
    }

    getOriginStart(sentence: ClipSrtLine): number {
        return sentence.start;
    }

    getOriginEnd(sentence: ClipSrtLine): number {
        return sentence.end;
    }

    getOriginAdjustedStart(sentence: ClipSrtLine): number | null {
        return null;
    }

    getOriginAdjustedEnd(sentence: ClipSrtLine): number | null {
        return null;
    }

    getOriginKey(sentence: ClipSrtLine): string {
        return `${this.srtKey}-${sentence.index}`;
    }
}
