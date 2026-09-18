import { describe, expect, it } from 'vitest';
import EnglishSubtitleSegmenter from '@/backend/utils/subtitle/EnglishSubtitleSegmenter';
import { SpeechRecognitionToken } from '@/backend/services/gateways/media/SpeechRecognitionGateway';
import { SrtLine } from '@/common/utils/subtitle';

const segmenter = new EnglishSubtitleSegmenter();

/** 生成一个词首 token（文本带前导空格，表示新单词）。 */
function word(text: string, start: number, end: number): SpeechRecognitionToken {
    return { text: ` ${text}`, start, end };
}

/** 生成一个附着标点 token（无前导空格，附着到前一个词）。 */
function punct(text: string, start: number, end: number): SpeechRecognitionToken {
    return { text, start, end };
}

/**
 * 生成等间距连续语料：每词 0.3 秒、词间 0.05 秒；
 * pauseAfterIndex（词下标）之后的词前插入一段长停顿（默认 0.9 秒）。
 */
function continuousSpeech(wordTexts: string[], pauseAfterIndex?: number, pauseSeconds = 0.9): SpeechRecognitionToken[] {
    const tokens: SpeechRecognitionToken[] = [];
    let at = 0;
    wordTexts.forEach((text, index) => {
        tokens.push(word(text, at, at + 0.3));
        at += 0.3 + (index === pauseAfterIndex ? pauseSeconds : 0.05);
    });
    return tokens;
}

/** 断言每个输入 token 的文本都按顺序出现在字幕行里，没有任何词被丢弃。 */
function expectFullCoverage(tokens: SpeechRecognitionToken[], lines: SrtLine[]): void {
    const joined = lines.map((line) => line.contentEn).join(' ');
    let searchFrom = 0;
    for (const token of tokens) {
        const text = token.text.trim();
        if (!text) continue;
        const at = joined.indexOf(text, searchFrom);
        expect(at, `字幕行应按顺序包含输入词「${text}」`).toBeGreaterThanOrEqual(searchFrom);
        searchFrom = at + text.length;
    }
}

/** 断言行满足硬上限（单个词的行不受字符/词数上限约束）且行与行时间不重叠。 */
function expectWellFormed(lines: SrtLine[]): void {
    lines.forEach((line, index) => {
        expect(line.end, `第 ${index + 1} 行结束时间应晚于开始时间`).toBeGreaterThan(line.start);
        expect(line.end - line.start, `第 ${index + 1} 行展示时长不应超过上限`).toBeLessThanOrEqual(6.5);
        const wordCount = line.contentEn.split(' ').filter(Boolean).length;
        if (wordCount > 1) {
            expect(line.contentEn.length, `第 ${index + 1} 行字符数不应超过上限`).toBeLessThanOrEqual(80);
            expect(wordCount, `第 ${index + 1} 行词数不应超过上限`).toBeLessThanOrEqual(16);
        }
        expect(line.index).toBe(index + 1);
        const next = lines[index + 1];
        if (next) {
            expect(line.end, `第 ${index + 1} 行不应与下一行时间重叠`).toBeLessThanOrEqual(next.start + 1e-9);
        }
    });
}

describe('英文字幕分段（子词归并）', () => {
    it('子词合并成单词、标点附着到前一个词且文本格式正确', () => {
        const tokens = [
            word('And', 0, 0.2),
            word('so', 0.25, 0.45),
            punct(',', 0.43, 0.45),
            word('my', 0.5, 0.65),
            word('fellow', 0.7, 1.0),
            word('Ame', 1.05, 1.2),
            { text: 'ricans', start: 1.2, end: 1.45 },
            punct('.', 1.43, 1.45),
        ];

        const lines = segmenter.segmentTimeline(tokens);

        expect(lines).toHaveLength(1);
        expect(lines[0].contentEn).toBe('And so, my fellow Americans.');
        expect(lines[0].start).toBe(0);
        expect(lines[0].end).toBe(1.45);
        expectFullCoverage(tokens, lines);
    });

    it('空时间轴返回空字幕', () => {
        expect(segmenter.segmentTimeline([])).toEqual([]);
        expect(segmenter.segmentTimeline([{ text: ' ', start: 0 }])).toEqual([]);
    });
});

describe('英文字幕分段（断句行为）', () => {
    it('孤立短句并入下一句，不产生一闪而过的孤行', () => {
        const tokens = [
            word('Right', 0, 0.35),
            punct('.', 0.33, 0.35),
            word('Okay', 0.5, 0.8),
            punct(',', 0.78, 0.8),
            word("let's", 0.9, 1.15),
            word('go', 1.2, 1.45),
            punct('.', 1.43, 1.45),
        ];

        const lines = segmenter.segmentTimeline(tokens);

        expect(lines).toHaveLength(1);
        expect(lines[0].contentEn).toBe("Right. Okay, let's go.");
        expect(lines[0].start).toBe(0);
        expect(lines[0].end).toBe(1.45);
        expectFullCoverage(tokens, lines);
    });

    it('两个完整长句各自成行，断在句号处', () => {
        const tokens = [
            word("That's", 0, 0.3),
            word('perfectly', 0.35, 0.75),
            word('fine', 0.8, 1.0),
            punct(',', 0.98, 1.0),
            word('thank', 1.05, 1.3),
            word('you', 1.35, 1.55),
            punct('.', 1.53, 1.55),
            word("Let's", 1.7, 2.0),
            word('continue', 2.05, 2.5),
            word('with', 2.55, 2.75),
            word('the', 2.8, 2.9),
            word('next', 2.95, 3.15),
            word('section', 3.2, 3.5),
            word('now', 3.55, 3.65),
            punct('.', 3.63, 3.65),
        ];

        const lines = segmenter.segmentTimeline(tokens);

        expect(lines.map((line) => line.contentEn)).toEqual([
            "That's perfectly fine, thank you.",
            "Let's continue with the next section now.",
        ]);
        expect(lines[0].end).toBe(1.55);
        expect(lines[1].start).toBe(1.7);
        expect(lines[1].end).toBe(3.65);
        expectWellFormed(lines);
        expectFullCoverage(tokens, lines);
    });

    it('长停顿处断行，行尾不拖到下一句开头', () => {
        const tokens = [
            word('Sure', 0, 0.35),
            punct('.', 0.33, 0.35),
            word('No', 2.4, 2.6),
            word('problem', 2.65, 3.0),
            punct('.', 2.98, 3.0),
        ];

        const lines = segmenter.segmentTimeline(tokens);

        expect(lines.map((line) => line.contentEn)).toEqual(['Sure.', 'No problem.']);
        // 第一行按最短展示时长延伸到 0.9 秒，但不会横跨 2 秒静音拖到下一行。
        expect(lines[0].end).toBe(0.9);
        expect(lines[1].start).toBe(2.4);
        expectWellFormed(lines);
        expectFullCoverage(tokens, lines);
    });

    it('没有真实结束时间时，词尾估算封顶，不把停顿吞进行尾', () => {
        const tokens: SpeechRecognitionToken[] = [
            { text: ' Sure', start: 0 },
            { text: '.', start: 0.35 },
            { text: ' No', start: 3.0 },
            { text: ' problem', start: 3.05 },
            { text: '.', start: 3.5 },
        ];

        const lines = segmenter.segmentTimeline(tokens);

        expect(lines.map((line) => line.contentEn)).toEqual(['Sure.', 'No problem.']);
        expect(lines[0].end).toBeGreaterThan(0.5);
        expect(lines[0].end).toBeLessThan(2.0);
        expect(lines[1].start).toBe(3.0);
    });

    it('无标点长流在最长停顿处断行，且所有行满足硬上限', () => {
        const wordTexts = Array.from({ length: 24 }, (_, index) => `word${String(index + 1).padStart(2, '0')}`);
        // 第 10 个词（下标 9）后插入 0.9 秒停顿，其余词连续。
        const tokens = continuousSpeech(wordTexts, 9);

        const lines = segmenter.segmentTimeline(tokens);

        expect(lines.map((line) => line.contentEn.split(' '))).toEqual([
            wordTexts.slice(0, 10),
            wordTexts.slice(10, 17),
            wordTexts.slice(17, 24),
        ]);
        expectWellFormed(lines);
        expectFullCoverage(tokens, lines);
    });

    it('语速慢的长流按行时长上限断行', () => {
        const wordTexts = Array.from({ length: 14 }, (_, index) => `word${String(index + 1).padStart(2, '0')}`);
        const tokens: SpeechRecognitionToken[] = [];
        let at = 0;
        wordTexts.forEach((text) => {
            tokens.push(word(text, at, at + 0.5));
            at += 0.55;
        });

        const lines = segmenter.segmentTimeline(tokens);

        expect(lines.length).toBeGreaterThanOrEqual(2);
        expectWellFormed(lines);
        expectFullCoverage(tokens, lines);
    });

    it('句末标点后接小写词不误判为句子结束（缩写词）', () => {
        const tokens = [
            word('The', 0, 0.2),
            word('U.S.', 0.25, 0.5),
            word('economy', 0.55, 1.0),
            word('grows', 1.05, 1.4),
        ];

        const lines = segmenter.segmentTimeline(tokens);

        expect(lines).toHaveLength(1);
        expect(lines[0].contentEn).toBe('The U.S. economy grows');
    });

    it('单个词超过行时长上限时仍完整展示，展示时长钳制在上限', () => {
        const tokens = [
            word('word', 0, 8.0),
            word('next', 8.5, 8.8),
        ];

        const lines = segmenter.segmentTimeline(tokens);

        expect(lines.map((line) => line.contentEn)).toEqual(['word', 'next']);
        expect(lines[0].end).toBe(6.5);
        expect(lines[1].start).toBe(8.5);
        expectFullCoverage(tokens, lines);
    });

    it('超长单词单独成行，不会被丢弃', () => {
        const tokens: SpeechRecognitionToken[] = [word('Hi', 0, 0.3), word('mon', 0.5, 0.6)];
        for (let index = 0; index < 20; index++) {
            tokens.push({ text: 'ster', start: 0.6 + index * 0.1, end: 0.7 + index * 0.1 });
        }

        const lines = segmenter.segmentTimeline(tokens);

        expect(lines).toHaveLength(2);
        expect(lines[0].contentEn).toBe('Hi');
        expect(lines[1].contentEn).toBe(`mon${'ster'.repeat(20)}`);
        expectFullCoverage(tokens, lines);
    });
});

describe('英文字幕分段（多块合并）', () => {
    it('重叠区只由后一块贡献，边界词不重复', () => {
        const chunk0 = [word('A', 0, 0.3), word('B', 119.6, 119.9)];
        const chunk1 = [word('B', 119.6, 119.9)];

        const lines = segmenter.segment([chunk0, chunk1], [0, 119]);

        expect(lines.map((line) => line.contentEn)).toEqual(['A', 'B']);
        expect(lines[0].start).toBe(0);
        expect(lines[1].start).toBe(119.6);
    });

    it('相同时间轴的重复子词只保留一份', () => {
        const lines = segmenter.segment([[word('Hi', 1, 1.3)], [word('Hi', 1, 1.3)]], [0, 0]);

        expect(lines).toHaveLength(1);
        expect(lines[0].contentEn).toBe('Hi');
    });
});
