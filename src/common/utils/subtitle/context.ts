import { Sentence } from '@/common/types/SentenceC';
import { ClipSrtLine } from '@/common/types/clipMeta';
import { SrtLine, validateSrtLine } from './types';
import { sentenceToSrtLine } from './sentence';
import { serializeSrt } from './serializer';

/**
 * 片段上下文：以目标行为中心的字幕片段完整信息。
 */
export interface SubtitleClipContext {
    /** 目标字幕行。 */
    clipLine: SrtLine;
    /** 目标行及前后 range 行的字幕行（按序号排序）。 */
    contextLines: SrtLine[];
    /** 上下文首行开始时间（秒）。 */
    startTime: number;
    /** 上下文末行结束时间（秒）。 */
    endTime: number;
    /** 上下文的 SRT 文本，用于派生片段稳定键。 */
    contentSrt: string;
    /** 时间归零到片段起点的字幕行（含目标行标记）。 */
    clipLines: ClipSrtLine[];
}

/**
 * 按序号排序并过滤非法行。
 */
function sortByIndex(srtLines: SrtLine[]): SrtLine[] {
    return srtLines.filter(line => validateSrtLine(line))
        .sort((a, b) => a.index - b.index);
}

/**
 * 根据序号查找字幕行。
 *
 * @param srtLines 字幕行数组。
 * @param index 目标序号。
 * @returns 匹配的字幕行；未找到返回 undefined。
 */
export function findByIndex(srtLines: SrtLine[], index: number): SrtLine | undefined {
    return srtLines.filter(line => validateSrtLine(line)).find(line => line.index === index);
}

/**
 * 获取指定序号前后 range 行的字幕。
 *
 * @param srtLines 字幕行数组。
 * @param targetIndex 目标序号。
 * @param range 前后行数。
 * @returns 范围内的字幕行（按序号排序）。
 */
export function getAroundLines(srtLines: SrtLine[], targetIndex: number, range: number): SrtLine[] {
    if (range < 0) {
        return [];
    }

    const sortedLines = sortByIndex(srtLines);
    if (sortedLines.length === 0) {
        return [];
    }

    const minIndex = sortedLines[0].index;
    const maxIndex = sortedLines[sortedLines.length - 1].index;

    const start = Math.max(minIndex, targetIndex - range);
    const end = Math.min(maxIndex, targetIndex + range);

    return sortedLines.filter(line => line.index >= start && line.index <= end);
}

/**
 * 以目标句为中心构建片段上下文，统一收藏/学习两处"取邻居→算范围→落 ClipMeta"的重复流程。
 *
 * @param sentences 源字幕的播放器句子。
 * @param indexInSrt 目标句序号。
 * @param range 前后行数，默认 5。
 * @returns 片段上下文；找不到目标句时抛错。
 */
export function buildClipContext(
    sentences: Sentence[],
    indexInSrt: number,
    range = 5
): SubtitleClipContext {
    const srtLines = sentences.map(sentenceToSrtLine);
    const clipLine = findByIndex(srtLines, indexInSrt);
    if (!clipLine) {
        throw new Error(`Subtitle line not found: ${indexInSrt}`);
    }

    const contextLines = getAroundLines(srtLines, indexInSrt, range);
    if (contextLines.length === 0) {
        throw new Error(`Subtitle context is empty: ${indexInSrt}`);
    }

    const startTime = contextLines[0].start;
    const endTime = contextLines[contextLines.length - 1].end;

    const clipLines: ClipSrtLine[] = contextLines.map((item, index) => ({
        index,
        start: item.start - startTime,
        end: item.end - startTime,
        contentEn: item.contentEn,
        contentZh: item.contentZh,
        isClip: item === clipLine
    }));

    return {
        clipLine,
        contextLines,
        startTime,
        endTime,
        contentSrt: serializeSrt(contextLines),
        clipLines
    };
}
