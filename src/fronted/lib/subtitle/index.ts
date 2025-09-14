export * from './types';
export * from './subtitleSession';
export * from './orchestrator';
export * from './reactPlayerAdapter';
export * from './zustandBridge';

// Factory functions for common use cases
import { Sentence } from '@/common/types/SentenceC';
import { ClipSrtLine } from '@/common/types/clipMeta';
import { SubtitleSessionOptions, createSubtitleSession } from './subtitleSession';

/**
 * 为 Sentence 类型创建 SubtitleSession 的工厂函数
 */
export function createSentenceSession(
  id: string,
  sentences: Sentence[],
  options?: Omit<SubtitleSessionOptions<Sentence>, 'id' | 'lines' | 'getId' | 'getStart' | 'getEnd' | 'getAdjustedStart' | 'getAdjustedEnd'>
) {
  return createSubtitleSession<Sentence>({
    id,
    lines: sentences,
    getId: (s) => `${s.fileHash}-${s.index}`,
    getStart: (s) => s.start,
    getEnd: (s) => s.end,
    getAdjustedStart: (s) => s.adjustedStart,
    getAdjustedEnd: (s) => s.adjustedEnd,
    ...options
  });
}

/**
 * 为 ClipSrtLine 类型创建 SubtitleSession 的工厂函数
 */
export function createClipSession(
  id: string,
  lines: ClipSrtLine[],
  srtKey: string,
  options?: Omit<SubtitleSessionOptions<ClipSrtLine>, 'id' | 'lines' | 'getId' | 'getStart' | 'getEnd'>
) {
  return createSubtitleSession<ClipSrtLine>({
    id,
    lines,
    getId: (l) => `${srtKey}-${l.index}`,
    getStart: (l) => l.start,
    getEnd: (l) => l.end,
    ...options
  });
}