import { ClipSrtLine } from '@/common/types/clipMeta';
import { Sentence } from '@/common/types/SentenceC';
import UrlUtil from '@/common/utils/UrlUtil';

/**
 * 将 ClipSrtLine 转换为 Sentence 格式，以便在 usePlayerV2 中使用
 */
export function convertClipSrtLinesToSentences(
  clipSrtLines: ClipSrtLine[],
  videoPath: string,
  clipKey: string
): Sentence[] {
  return clipSrtLines.map((line, index) => ({
    fileHash: clipKey, // 使用 clip key 作为文件哈希
    filePath: videoPath,
    index: line.index,
    start: line.start,
    end: line.end,
    adjustedStart: null, // ClipSrtLine 没有调整时间功能
    adjustedEnd: null,
    text: line.contentEn,
    textZH: line.contentZh,
    key: `${clipKey}-${line.index}`,
    transGroup: 1, // 默认分组
    translationKey: `${clipKey}-${line.index}`, // 简单的翻译键
    struct: {} as any // 空结构体
  }));
}

/**
 * 从 Sentence 转换回 ClipSrtLine（如果需要）
 */
export function convertSentenceToClipSrtLine(sentence: Sentence): ClipSrtLine {
  return {
    index: sentence.index,
    start: sentence.start,
    end: sentence.end,
    contentEn: sentence.text,
    contentZh: sentence.textZH,
    isClip: false // 默认值，需要根据业务逻辑设置
  };
}