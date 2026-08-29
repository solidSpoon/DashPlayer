import { Sentence } from '@/common/types/SentenceC';

/** 将后端内存增量字幕行转换为播放器句子。 */
export function toIncrementalSentence(line: { index: number; start: number; end: number; contentEn: string; contentZh: string }, sessionId: string): Sentence {
    const key = `${sessionId}-${line.index}`;
    return {
        fileHash: sessionId,
        index: line.index,
        start: line.start,
        end: line.end,
        adjustedStart: null,
        adjustedEnd: null,
        text: line.contentEn,
        textZH: line.contentZh,
        key,
        transGroup: 0,
        translationKey: key,
        struct: { original: line.contentEn, blocks: line.contentEn.split(/\s+/).filter(Boolean).map((content) => ({ blockParts: [{ content, implicit: content, isWord: true }] })) },
    };
}
