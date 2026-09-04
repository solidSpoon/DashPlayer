import { Sentence } from '@/common/types/SentenceC';
import { SentenceStruct } from '@/common/types/SentenceStruct';
import { ClipSrtLine } from '@/common/types/clipMeta';
import { SrtLine, createSrtLine } from './types';

/**
 * 从播放器句子创建字幕行。
 *
 * @param sentence 播放器句子。
 * @returns 字幕行。
 */
export function sentenceToSrtLine(sentence: Sentence): SrtLine {
    return createSrtLine(
        sentence.index,
        sentence.start,
        sentence.end,
        sentence.text ?? '',
        sentence.textZH ?? ''
    );
}

/**
 * 从字幕行构造播放器句子。
 *
 * index 需显式传入：字幕文件解析路径按数组位置从 0 编号，
 * 增量转录路径使用 SrtLine 的稳定序号，两条链路语义不同，不可互相覆盖。
 *
 * @param line 字幕行。
 * @param fileHash 字幕文件哈希（或转录会话等稳定标识）。
 * @param struct 句法解析结果。
 * @param index 句子序号，由调用链路决定。
 * @returns 播放器句子。
 */
export function srtLineToSentence(
    line: SrtLine,
    fileHash: string,
    struct: SentenceStruct,
    index: number
): Sentence {
    return {
        fileHash,
        index,
        start: line.start,
        end: line.end,
        adjustedStart: null,
        adjustedEnd: null,
        text: line.contentEn,
        textZH: line.contentZh,
        key: `${fileHash}-${index}`,
        transGroup: 0,
        translationKey: `${fileHash}:${index}`,
        struct
    };
}

/**
 * 将收藏片段的字幕行转换为播放器句子，供片段播放器使用。
 *
 * @param clipSrtLines 片段字幕行。
 * @param videoPath 源视频路径。
 * @param clipKey 片段稳定键，用作文件哈希。
 * @returns 播放器句子数组。
 */
export function clipLinesToSentences(
    clipSrtLines: ClipSrtLine[],
    videoPath: string,
    clipKey: string
): Sentence[] {
    return clipSrtLines.map((line) => ({
        fileHash: clipKey,
        filePath: videoPath,
        index: line.index,
        start: line.start,
        end: line.end,
        adjustedStart: null,
        adjustedEnd: null,
        text: line.contentEn,
        textZH: line.contentZh,
        key: `${clipKey}-${line.index}`,
        transGroup: 1,
        translationKey: `${clipKey}:${line.index}`,
        struct: { original: line.contentEn, blocks: [] } as SentenceStruct
    }));
}
