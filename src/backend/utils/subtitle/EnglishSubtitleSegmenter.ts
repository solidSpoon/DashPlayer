import { SpeechRecognitionToken } from '@/backend/services/gateways/media/SpeechRecognitionGateway';
import { SrtLine } from '@/common/utils/SrtUtil';

/** 语音识别时间轴归并后的英文单词。 */
interface TimedWord {
    /** 单词及其尾随标点。 */
    word: string;
    /** 开始时间，单位为秒。 */
    start: number;
    /** 结束时间，单位为秒。 */
    end: number;
}

/** 英文字幕分段器，将模型子词时间轴转换为播放器使用的字幕行。 */
export default class EnglishSubtitleSegmenter {
    /**
     * 将多个分段的 SentencePiece 子词时间轴合并为英文字幕行。
     * 每个分段按切分点分区负责 [ownCut, nextCut) 的时间区间，重叠区由后续分段独占，
     * 从而避免切分边界处的内容重复出现。
     * @param chunkTimelines 每个分段的时间轴；时间戳均已加上该分段的起始偏移。
     * @param cutPoints 每个分段的原始切分点（秒）：第 0 段为 0，第 i 段为上一个切分点（不含重叠）。
     * @returns 已按阅读时长、字数和停顿切分的字幕行。
     */
    public segment(chunkTimelines: SpeechRecognitionToken[][], cutPoints: number[]): SrtLine[] {
        const timeline = this.mergeTimelines(chunkTimelines, cutPoints);
        return this.segmentTimeline(timeline);
    }

    /**
     * 将多段时间轴按切分点分区合并：每个分段只保留 [ownCut, nextCut) 区间内的子词，
     * 重叠区（同一音频被相邻两段识别）只由覆盖它的后续分段贡献，不依赖时间戳完全相等。
     * @param chunkTimelines 每个分段的时间轴。
     * @param cutPoints 每个分段的原始切分点（秒）。
     * @returns 全局唯一、按时间排序的子词序列。
     */
    public mergeTimelines(chunkTimelines: SpeechRecognitionToken[][], cutPoints: number[]): SpeechRecognitionToken[] {
        const raw: SpeechRecognitionToken[] = [];
        for (let index = 0; index < chunkTimelines.length; index++) {
            const ownCut = cutPoints[index] ?? 0;
            const nextCut = cutPoints[index + 1] ?? Number.POSITIVE_INFINITY;
            for (const token of chunkTimelines[index]) {
                const text = token.text.trim();
                if (!text) continue;
                if (token.start < ownCut || token.start >= nextCut) continue;
                raw.push(token);
            }
        }
        // 按音频绝对时间排序。
        raw.sort((a, b) => a.start - b.start);
        const merged: SpeechRecognitionToken[] = [];
        const seen = new Set<string>();
        for (const token of raw) {
            const text = token.text.trim();
            const key = `${text}@${token.start.toFixed(3)}`;
            if (seen.has(key)) continue;
            seen.add(key);
            merged.push(token);
        }
        return merged;
    }

    /**
     * 将全局子词时间轴转换为英文字幕行。
     * @param tokens 按时间顺序排列的模型子词。
     * @returns 已按阅读时长、字数和停顿切分的字幕行。
     */
    public segmentTimeline(tokens: SpeechRecognitionToken[]): SrtLine[] {
        return this.createSegments(this.createWords(tokens)).map((segment, index) => ({
            index: index + 1,
            start: segment.start,
            end: segment.end,
            contentEn: segment.text,
            contentZh: '',
        }));
    }

    /**
     * 将 SentencePiece 子词归并为单词。
     * @param tokens 按时间顺序排列的模型子词。
     * @returns 带起止时间的英文单词。
     */
    private createWords(tokens: SpeechRecognitionToken[]): TimedWord[] {
        const words: TimedWord[] = [];
        let current: TimedWord | null = null;
        for (let index = 0; index < tokens.length; index++) {
            const token = tokens[index];
            const nextToken = tokens[index + 1] ?? null;
            const startsWord = /^\s/.test(token.text);
            const text = token.text.trim();
            if (!text) continue;
            if (startsWord && current) {
                words.push(current);
                current = null;
            }
            if (/^[,.;:!?]+$/.test(text) && current) {
                current.word += text;
                current.end = Math.max(current.end, this.resolveWordEnd(token, nextToken));
                continue;
            }
            if (!current) current = { word: text, start: token.start, end: this.resolveWordEnd(token, nextToken) };
            else {
                current.word += text;
                current.end = Math.max(current.end, this.resolveWordEnd(token, nextToken));
            }
        }
        if (current) words.push(current);
        return words;
    }

    /**
     * 估算当前单词的结束时间：优先取下一个子词的开始时间，没有下一个时用固定增量兜底。
     * @param token 当前子词。
     * @param nextToken 时间轴上的下一个子词，可能为空。
     * @returns 单词的估算结束时间。
     */
    private resolveWordEnd(token: SpeechRecognitionToken, nextToken: SpeechRecognitionToken | null): number {
        if (nextToken) {
            return nextToken.start;
        }
        return token.start + 0.32;
    }

    /**
     * 根据阅读长度、停顿和标点将单词时间轴切成字幕段。
     * @param words 按时间顺序排列的单词。
     * @returns 可直接序列化的字幕段。
     */
    private createSegments(words: TimedWord[]): Array<{ start: number; end: number; text: string }> {
        const maxDuration = 6.5;
        const maxWords = 16;
        const maxChars = 80;
        const gapBreak = 0.6;
        const punctuation = /^[,.;:!?]+$/;
        const segments: Array<{ start: number; end: number; text: string }> = [];
        let current: { start: number; end: number; words: string[]; wordCount: number; charCount: number } | null = null;
        let previousEnd = words[0]?.start ?? 0;
        const flush = (): void => {
            if (!current) return;
            const text = current.words.join(' ').replace(/\s+([,.;:!?])/g, '$1').trim();
            if (text) segments.push({ start: current.start, end: current.end, text });
            current = null;
        };
        for (const word of words) {
            const text = word.word.trim();
            if (!text) continue;
            if (current && word.start - previousEnd >= gapBreak) flush();
            if (!current) current = { start: word.start, end: word.end, words: [], wordCount: 0, charCount: 0 };
            const separatorLength = current.words.length > 0 && !punctuation.test(text) ? 1 : 0;
            const exceeds = word.end - current.start > maxDuration
                || current.wordCount + (punctuation.test(text) ? 0 : 1) > maxWords
                || current.charCount + separatorLength + text.length > maxChars;
            if (exceeds) {
                flush();
                current = { start: word.start, end: word.end, words: [], wordCount: 0, charCount: 0 };
            }
            current.words.push(text);
            current.end = word.end;
            current.wordCount += punctuation.test(text) ? 0 : 1;
            current.charCount += separatorLength + text.length;
            previousEnd = word.end;
            if (/[.!?]+$/.test(text)) flush();
            else if (/[,;:]+$/.test(text) && (current.wordCount >= 8 || current.charCount >= 52 || current.end - current.start >= 5.2)) flush();
        }
        flush();
        return segments.filter((segment) => Number.isFinite(segment.start) && Number.isFinite(segment.end) && segment.end > segment.start);
    }
}
