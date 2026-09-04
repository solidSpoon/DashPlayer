/**
 * 字幕处理统一模块。
 *
 * 对外公开：解析（SRT/VTT/ASS）、SRT 序列化、时间文本互转、
 * 邻居句/片段上下文、Sentence/SrtLine/ClipSrtLine 转换、单词切分。
 * 内部实现文件不应被直接 import。
 */
export type { SrtLine } from './types';
export { parseSrt, parseAss } from './parser';
export { serializeSrt } from './serializer';
export { timeTextToSeconds, secondsToSrtTimestamp } from './time';
export { getAroundLines, findByIndex, buildClipContext } from './context';
export type { SubtitleClipContext } from './context';
export { sentenceToSrtLine, srtLineToSentence, clipLinesToSentences } from './sentence';
export { SPLIT_REGEX, splitWords, isWordToken, cleanWord } from './tokenize';
