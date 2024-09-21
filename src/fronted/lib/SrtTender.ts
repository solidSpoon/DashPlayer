import SentenceC from '@/common/types/SentenceC';
import CollUtil from '@/common/utils/CollUtil';

interface TenderLine {
    index: number;
    t1: number;
    t2: number;
    opId: number;
    origin: SentenceC;
}

export interface SrtTender {
    getByTime(time: number): SentenceC;

    mapSeekTime(time: number | SentenceC): { start: number, end: number };

    mapSeekTimeStraight(time: number | SentenceC): { start: number, end: number };

    adjustBegin(sentence: SentenceC, time: number): void;

    adjustEnd(sentence: SentenceC, time: number): void;

    adjusted(sentence: SentenceC, delta?: number): boolean;

    clearAdjust(sentence: SentenceC): void;

    timeDiff(sentence: SentenceC): { start: number, end: number };

    update(sentence: SentenceC): void;
}


class TenderUtils {
    public static sentenceKey(sentence: SentenceC) {
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
    private lastIndex: number | null = null;

    constructor(sentences: SentenceC[]) {
        if (CollUtil.isEmpty(sentences)) return;
        const tempLines = this.mapToLine(sentences);
        tempLines.forEach((item) => {
            this.put(item);
        });
        for (const l of this.lines) {
            this.keyLineMapping.set(TenderUtils.sentenceKey(l.origin), l.index);
        }
    }

    public getByTime(time: number): SentenceC {
        return this.getByTimeInternal(time, this.isCurrent.bind(this)).origin;
    }

    public mapSeekTime(time: number | SentenceC): { start: number, end: number } {
        const { t1, t2 } = typeof time === 'number' ?
            this.getByTimeInternal(time, this.isCurrent.bind(this)) :
            this.getByT(time);
        return {
            start: t1,
            end: t2
        };
    }

    public mapSeekTimeStraight(time: number | SentenceC): { start: number, end: number } {
        const { t1, t2 } = typeof time === 'number' ?
            this.getByTimeInternal(time, this.isCurrentStraight.bind(this)) :
            this.getByT(time);
        return {
            start: t1,
            end: t2
        };
    }

    public adjustBegin(sentence: SentenceC, time: number): void {
        const line = this.getByT(sentence);
        this.put({
            ...line,
            t1: line.t1 + time
        });
    }

    public adjustEnd(sentence: SentenceC, time: number): void {
        const line = this.getByT(sentence);
        this.put({
            ...line,
            t2: line.t2 + time
        });
    }

    public adjusted(sentence: SentenceC, delta = 0.05): boolean {
        const line = this.getByT(sentence);
        const origin = line.origin;
        return Math.abs(line.t1 - origin.currentBegin) < delta || Math.abs(line.t2 - origin.currentEnd) < delta;
    }

    public clearAdjust(sentence: SentenceC) {
        const line = this.getByT(sentence);
        this.put({
            ...line,
            t1: line.origin.currentBegin,
            t2: line.origin.currentEnd
        });
    }

    public timeDiff(sentence: SentenceC): { start: number, end: number } {
        const line = this.getByT(sentence);
        const origin = line.origin;
        return {
            start: line.t1 - origin.currentBegin,
            end: line.t2 - origin.currentEnd
        };
    }

    public update(sentence: SentenceC) {
        const line = this.getByT(sentence);
        this.put({
            ...line,
            origin: sentence
        });
    }

    private getByT(sentence: SentenceC): TenderLine {
        const index = this.keyLineMapping.get(TenderUtils.sentenceKey(sentence));
        return this.lines[index];
    }

    private isCurrent(line: TenderLine, time: number) {
        const start = Math.min(line.t1, line.t2, this.nextStart(line));
        const end = Math.max(line.t1, line.t2, this.nextStart(line));
        return time >= start && time <= end;
    }

    public isCurrentStraight(line: TenderLine, time: number) {
        const start = Math.min(line.t1, line.t2);
        const end = Math.max(line.t1, line.t2);
        return time >= start && time <= end;
    }

    private put(item: TenderLine) {
        const tempItem = {
            ...this.orderTime(item),
            opId: this.MAX_OP_ID++
        };
        this.deleteInBucket(tempItem.index);
        this.lines[tempItem.index] = tempItem;
        const [minIndex, maxIndex] = this.mapIndex(tempItem);
        for (let i = minIndex; i <= maxIndex; i += 1) {
            const group = this.lineBucket.get(i) ?? [];
            // opId 越大越靠前
            group.sort((a, b) => b.opId - a.opId);
            group.push(tempItem);
            this.lineBucket.set(i, group);
        }
        this.lastIndex = null;
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

    private mapToLine(sentences: SentenceC[]): TenderLine[] {
        let index = 0;
        return sentences.map((sentence) => ({
                index: index++,
                t1: sentence.currentBegin ?? 0,
                t2: sentence.currentEnd ?? 0,
                opId: this.MAX_OP_ID,
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

    private getByTimeInternal(time: number, isCurrent: (line: TenderLine, time: number) => boolean) {
        if (this.lastIndex !== null) {
            const line = this.lines[this.lastIndex];
            if (isCurrent(line, time)) {
                return line;
            }
        }
        const index = Math.floor(time / this.GROUP_SECONDS);
        const group = this.lineBucket.get(index) ?? [];
        for (const line of group) {
            if (isCurrent(line, time)) {
                return line;
            }
        }
        const tenderLine = this.lines[this.lines.length - 1];
        this.lastIndex = tenderLine.index;
        return tenderLine;
    }
}
