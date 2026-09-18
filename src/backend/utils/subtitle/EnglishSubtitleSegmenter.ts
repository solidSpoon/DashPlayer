import { SpeechRecognitionToken } from '@/backend/services/gateways/media/SpeechRecognitionGateway';
import { SrtLine } from '@/common/utils/subtitle';

/** 语音识别时间轴归并后的英文单词。 */
interface TimedWord {
    /** 单词及其尾随标点。 */
    word: string;
    /** 开始时间，单位为秒。 */
    start: number;
    /** 结束时间，单位为秒；引擎未提供真实结束时为封顶估算值。 */
    end: number;
}

/** 候选字幕行在动态规划搜索中逐步累计的指标。 */
interface LineMetrics {
    /** 展示字符数，含词间空格；附着标点不加空格。 */
    chars: number;
    /** 实词数量；附着标点不计。 */
    wordCount: number;
    /** 行内停顿次数：相邻词间隔达到自然停顿阈值。 */
    pauseCount: number;
}

/** 纯标点 token（附着到前一个词，不单独成词）。 */
const PUNCTUATION_TOKEN = /^[,.;:!?]+$/;

/** 行时间跨度硬上限（秒）。 */
const MAX_LINE_SECONDS = 6.5;
/** 行实词数硬上限。 */
const MAX_LINE_WORDS = 16;
/** 行展示字符数硬上限。 */
const MAX_LINE_CHARS = 80;
/** 词间停顿达到该值（秒）视为自然断点。 */
const PAUSE_BREAK_SECONDS = 0.6;
/** 中等停顿阈值（秒）：无标点时也优于硬切。 */
const MEDIUM_PAUSE_SECONDS = 0.3;
/** 行最短展示时长（秒）：更短的行向下延伸，但不越过下一行。 */
const MIN_DISPLAY_SECONDS = 0.9;
/** 无真实结束时间时单个子词的估算时长上限（秒），防止词尾吞掉后续静音。 */
const ESTIMATED_TOKEN_MAX_SECONDS = 0.8;
/** 时间轴末尾子词的估算展示时长（秒）。 */
const LAST_TOKEN_TAIL_SECONDS = 0.32;

/** 断点代价：句末标点与自然停顿免费，逗号类与中等停顿次之，无信号硬切最贵。 */
const BREAK_AFTER_MEDIUM_PUNCT_COST = 30;
const BREAK_AFTER_MEDIUM_PAUSE_COST = 45;
const BREAK_HARD_CUT_COST = 140;

/** 行代价：短行按字符差线性惩罚，阈值与斜率见常量。 */
const SHORT_LINE_CHARS = 24;
const SHORT_LINE_COST_PER_CHAR = 6;
/** 行代价：超过该字符数后按平方惩罚，鼓励拆成两条而不是一条长行。 */
const LONG_LINE_CHARS = 40;
const LONG_LINE_COST_K = 0.05;
/** 行代价：阅读速度超过舒适值（字符/秒）后按平方惩罚，另有封顶。 */
const COMFORT_CPS = 18;
const FAST_CPS_COST_K = 0.5;
const FAST_CPS_COST_CAP = 300;
/** 行代价：行时长超过该值（秒）后线性惩罚。 */
const LONG_DURATION_START_SECONDS = 5.5;
const LONG_DURATION_COST_PER_SECOND = 20;
/** 行代价：把两句话跨长停顿并成一行（行内含静音段）的惩罚。 */
const INTERNAL_PAUSE_COST = 250;
/** 每行基础代价：让总代价在同分时偏向更少的行。 */
const LINE_BASE_COST = 1;

/**
 * 英文字幕分段器，将模型子词时间轴转换为播放器使用的字幕行。
 *
 * 切分采用动态规划求全局最优：断点代价按信号强度计（句末标点/自然停顿免费、
 * 逗号次之、无信号硬切最贵），行代价综合阅读速度、行长、行时长与跨停顿合并，
 * 避免贪心逐词判定产生孤行与失衡切分。
 */
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
     * @returns 已按全局最优代价切分的字幕行。
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
     *
     * 纯标点 token 附着到当前词（或上一个已完成词）的尾部，不单独成词；
     * 词结束时间优先取引擎返回的真实值，缺失时用下一个子词开始时间估算并封顶。
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
            const end = this.resolveTokenEnd(token, nextToken);
            if (PUNCTUATION_TOKEN.test(text)) {
                const target = current ?? words[words.length - 1];
                if (target) {
                    target.word += text;
                    target.end = Math.max(target.end, end);
                    continue;
                }
            }
            if (!current) {
                current = { word: text, start: token.start, end };
            } else {
                current.word += text;
                current.end = Math.max(current.end, end);
            }
        }
        if (current) words.push(current);
        return words;
    }

    /**
     * 解析子词结束时间：优先使用引擎返回的真实结束时间；
     * 只提供开始时间的引擎用下一子词开始时间估算，并按子词时长上限封顶，
     * 避免词尾被后续静音无限拉长。
     * @param token 当前子词。
     * @param nextToken 时间轴上的下一个子词，可能为空。
     * @returns 子词的结束时间（秒）。
     */
    private resolveTokenEnd(token: SpeechRecognitionToken, nextToken: SpeechRecognitionToken | null): number {
        if (token.end !== undefined) return token.end;
        const estimated = nextToken ? nextToken.start : token.start + LAST_TOKEN_TAIL_SECONDS;
        return Math.min(estimated, token.start + ESTIMATED_TOKEN_MAX_SECONDS);
    }

    /**
     * 用动态规划把单词时间轴切成展示总代价最低的字幕行。
     *
     * bestCost[i] 为切完前 i 个单词的最小总代价；行首从 i-1 向左扩展，
     * 任一硬约束（字符数/词数/时长）越界后更长的行必然也越界，直接停止。
     * 单词行不受硬上限约束：超长单词也必须完整展示，只钳制展示时长。
     * @param words 按时间顺序排列的单词。
     * @returns 切好的字幕段。
     */
    private createSegments(words: TimedWord[]): Array<{ start: number; end: number; text: string }> {
        const total = words.length;
        if (total === 0) return [];
        const bestCost = new Array<number>(total + 1).fill(Number.POSITIVE_INFINITY);
        const bestFrom = new Array<number>(total + 1).fill(-1);
        bestCost[0] = 0;
        for (let end = 1; end <= total; end++) {
            const metrics: LineMetrics = { chars: 0, wordCount: 0, pauseCount: 0 };
            for (let start = end - 1; start >= 0; start--) {
                const word = words[start];
                const isPunctuation = PUNCTUATION_TOKEN.test(word.word);
                metrics.wordCount += isPunctuation ? 0 : 1;
                if (start === end - 1) {
                    metrics.chars += word.word.length;
                } else {
                    metrics.chars += word.word.length + (isPunctuation ? 0 : 1);
                    const gap = words[start + 1].start - word.end;
                    if (gap >= PAUSE_BREAK_SECONDS) metrics.pauseCount++;
                }
                const span = words[end - 1].end - word.start;
                const singleWord = start === end - 1;
                const withinLimits = singleWord
                    || (metrics.chars <= MAX_LINE_CHARS && metrics.wordCount <= MAX_LINE_WORDS && span <= MAX_LINE_SECONDS);
                if (withinLimits) {
                    const candidate = bestCost[start]
                        + this.breakCost(words, start)
                        + this.lineCost(metrics, span)
                        + LINE_BASE_COST;
                    if (candidate < bestCost[end]) {
                        bestCost[end] = candidate;
                        bestFrom[end] = start;
                    }
                }
                if (!singleWord && (metrics.chars > MAX_LINE_CHARS || metrics.wordCount > MAX_LINE_WORDS || span > MAX_LINE_SECONDS)) {
                    break;
                }
            }
        }
        return this.buildLines(words, bestFrom);
    }

    /**
     * 计算在 wordIndex 前断行的代价。
     *
     * 句末标点与自然停顿是免费断点；句末判定要求下一个词以大写开头，
     * 避免 "U.S." 这类缩写词误判为句子结束。逗号类标点与中等停顿次之，
     * 无任何信号的硬切最贵。
     * @param words 单词时间轴。
     * @param wordIndex 断点所在单词下标。
     * @returns 断点代价。
     */
    private breakCost(words: TimedWord[], wordIndex: number): number {
        if (wordIndex === 0) return 0;
        const previous = words[wordIndex - 1];
        const next = words[wordIndex];
        if (/[.!?]$/.test(previous.word) && /^[A-Z]/.test(next.word)) return 0;
        const gap = next.start - previous.end;
        if (gap >= PAUSE_BREAK_SECONDS) return 0;
        if (/[,;:]$/.test(previous.word)) return BREAK_AFTER_MEDIUM_PUNCT_COST;
        if (gap >= MEDIUM_PAUSE_SECONDS) return BREAK_AFTER_MEDIUM_PAUSE_COST;
        return BREAK_HARD_CUT_COST;
    }

    /**
     * 计算一条候选行的展示代价：阅读速度过快、行过短/过长、
     * 行时长过久与行内横跨自然停顿都会被惩罚。
     * @param metrics 行的累计指标。
     * @param span 行时间跨度（秒）。
     * @returns 行展示代价。
     */
    private lineCost(metrics: LineMetrics, span: number): number {
        const duration = Math.max(span, 0.2);
        const cps = metrics.chars / duration;
        const fastCost = Math.min(FAST_CPS_COST_CAP, FAST_CPS_COST_K * Math.max(0, cps - COMFORT_CPS) ** 2);
        const shortCost = SHORT_LINE_COST_PER_CHAR * Math.max(0, SHORT_LINE_CHARS - metrics.chars);
        const longCost = LONG_LINE_COST_K * Math.max(0, metrics.chars - LONG_LINE_CHARS) ** 2;
        const lingeringCost = LONG_DURATION_COST_PER_SECOND * Math.max(0, span - LONG_DURATION_START_SECONDS);
        return fastCost + shortCost + longCost + lingeringCost + metrics.pauseCount * INTERNAL_PAUSE_COST;
    }

    /**
     * 回溯最优切分并生成字幕段：行尾取行末单词的结束时间，
     * 展示时长做最短时长、下一行起点与行时长上限的三向钳制。
     * @param words 单词时间轴。
     * @param bestFrom 动态规划记录的每段行首下标。
     * @returns 可直接序列化的字幕段。
     */
    private buildLines(words: TimedWord[], bestFrom: number[]): Array<{ start: number; end: number; text: string }> {
        const total = words.length;
        const starts: number[] = [];
        for (let boundary = total; boundary > 0; boundary = bestFrom[boundary]) {
            starts.push(bestFrom[boundary]);
        }
        starts.reverse();
        const segments: Array<{ start: number; end: number; text: string }> = [];
        for (let position = 0; position < starts.length; position++) {
            const from = starts[position];
            const to = position + 1 < starts.length ? starts[position + 1] : total;
            const text = words.slice(from, to).map((word) => word.word).join(' ').replace(/\s+([,.;:!?]+)/g, '$1').trim();
            if (!text) continue;
            const start = words[from].start;
            const nextStart = to < total ? words[to].start : Number.POSITIVE_INFINITY;
            const end = Math.min(
                nextStart,
                Math.max(words[to - 1].end, start + MIN_DISPLAY_SECONDS),
                start + MAX_LINE_SECONDS,
            );
            segments.push({ start, end, text });
        }
        return segments.filter((segment) => Number.isFinite(segment.start) && Number.isFinite(segment.end) && segment.end > segment.start);
    }
}
