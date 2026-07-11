import { SpeechRecognitionToken } from '@/backend/application/ports/gateways/media/SpeechRecognitionGateway';
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
     * 将 SentencePiece 子词时间轴转换为英文字幕行。
     * @param tokens 按时间顺序排列的模型子词。
     * @returns 已按阅读时长、字数和停顿切分的字幕行。
     */
    public segment(tokens: SpeechRecognitionToken[]): SrtLine[] {
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
            const nextStart = tokens[index + 1]?.start ?? token.start + 0.32;
            const startsWord = /^\s/.test(token.text);
            const text = token.text.trim();
            if (!text) continue;
            if (startsWord && current) {
                words.push(current);
                current = null;
            }
            if (/^[,.;:!?]+$/.test(text) && current) {
                current.word += text;
                current.end = Math.max(current.end, nextStart);
                continue;
            }
            if (!current) current = { word: text, start: token.start, end: Math.max(token.start + 0.08, nextStart) };
            else {
                current.word += text;
                current.end = Math.max(current.end, nextStart);
            }
        }
        if (current) words.push(current);
        return words;
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
