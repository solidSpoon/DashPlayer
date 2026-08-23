import React, { useEffect, memo, useRef, useCallback } from 'react';
import UrlUtil from '@/common/utils/UrlUtil';
import SubtitleList from './SubtitleList';
import { VideoClip } from '../types';
import { AspectRatio } from '@/fronted/components/ui/aspect-ratio';
import VideoPlayerShortcut from './VideoPlayerShortcut';
import PlayerEngine from '@/fronted/features/player/components/PlayerEngine';
import { usePlayerState } from '@/fronted/features/player/playerState';
import { convertClipSrtLinesToSentences } from '@/fronted/lib/clipToSentenceConverter';
import { useVocabularyState } from '@/fronted/features/player/vocabularyStore';
import { Sentence } from '@/common/types/SentenceC';
import { ClipSrtLine } from '@/common/types/clipMeta';
import { videoLearningApi } from '@/fronted/features/video-learning/videoLearningApi';
import { ClipVocabularyEntry } from '@/common/types/vo/VideoLearningClipVO';

const SubtitleListWithProgress = memo(function SubtitleListWithProgress({
  lines,
  activeIndex,
  playing,
  autoPause,
  singleRepeat,
  onPickLine,
  onTogglePlay,
  onToggleAutoPause,
  onToggleSingleRepeat
}: {
  lines: ClipSrtLine[];
  activeIndex: number;
  playing: boolean;
  autoPause: boolean;
  singleRepeat: boolean;
  onPickLine: (idx: number) => void;
  onTogglePlay: () => void;
  onToggleAutoPause: () => void;
  onToggleSingleRepeat: () => void;
}) {
  return (
    <SubtitleList
      lines={lines}
      activeIndex={activeIndex}
      playing={playing}
      autoPause={autoPause}
      singleRepeat={singleRepeat}
      onPickLine={onPickLine}
      onTogglePlay={onTogglePlay}
      onToggleAutoPause={onToggleAutoPause}
      onToggleSingleRepeat={onToggleSingleRepeat}
    />
  );
});

type Props = {
  clip: VideoClip | null;
  lineIdx: number;                  // 当前要播放/高亮的字幕索引
  onLineIdxChange: (idx: number) => void;
  onPrevSentence: () => void;       // Left
  onNextSentence: () => void;       // Right
  onEnded: () => void;              // 视频播完
  forcePlayKey?: number;            // 用于强制播放的key
};

export default function VideoPlayerPane({
  clip,
  lineIdx,
  onLineIdxChange,
  onPrevSentence,
  onNextSentence,
  onEnded,
  forcePlayKey,
}: Props) {
  // 使用新的播放器状态管理 - 精确订阅避免频繁重渲染
  const playing = usePlayerState((s) => s.playing);
  const currentSentence = usePlayerState((s) => s.currentSentence);
  const sentences = usePlayerState((s) => s.sentences);
  const autoPause = usePlayerState((s) => s.autoPause);
  const singleRepeat = usePlayerState((s) => s.singleRepeat);

  // 播放控制方法
  const play = usePlayerState((s) => s.play);
  const togglePlay = usePlayerState((s) => s.togglePlay);
  const seekToTarget = usePlayerState((s) => s.seekToTarget);

  // 模式控制方法
  const setAutoPause = usePlayerState((s) => s.setAutoPause);
  const setSingleRepeat = usePlayerState((s) => s.setSingleRepeat);

  // 字幕相关方法
  const setSource = usePlayerState((s) => s.setSource);
  const loadSubtitles = usePlayerState((s) => s.loadSubtitles);
  const clearSubtitles = usePlayerState((s) => s.clearSubtitles);
  const setVocabularyWords = useVocabularyState((s) => s.setVocabularyWords);
  const setVocabularyForms = useVocabularyState((s) => s.setVocabularyForms);
  const clearVocabularyWords = useVocabularyState((s) => s.clearVocabularyWords);

  const playerReadyRef = useRef(false);
  const pendingTargetRef = useRef<{ sentence: Sentence; time: number } | null>(null);
  const pendingHighlightRef = useRef<{ fileHash?: string; index: number } | null>(null);
  const autoPlayRef = useRef(false);
  const lineIdxRef = useRef(lineIdx);
  const resolvedVocabularyCacheRef = useRef<Record<string, ClipVocabularyEntry[]>>({});

  useEffect(() => {
    lineIdxRef.current = lineIdx;
  }, [lineIdx]);

  const currentSentenceRef = useRef<Sentence | null>(currentSentence);
  useEffect(() => {
    currentSentenceRef.current = currentSentence;
  }, [currentSentence]);

  const queuePendingTarget = useCallback((sentence: Sentence | null | undefined) => {
    if (!sentence) {
      pendingTargetRef.current = null;
      pendingHighlightRef.current = null;
      return;
    }
    pendingTargetRef.current = { sentence, time: sentence.start };
    pendingHighlightRef.current = {
      fileHash: sentence.fileHash,
      index: sentence.index
    };
  }, []);

  const applyPendingTarget = useCallback(() => {
    if (!pendingTargetRef.current) {
      return;
    }
    const target = pendingTargetRef.current;
    pendingHighlightRef.current = {
      fileHash: target.sentence.fileHash,
      index: target.sentence.index
    };
    seekToTarget({ time: target.time, target: target.sentence });
    pendingTargetRef.current = null;
  }, [seekToTarget]);

  const handlePlayerReady = useCallback(() => {
    playerReadyRef.current = true;
    applyPendingTarget();
    if (autoPlayRef.current) {
      play();
      autoPlayRef.current = false;
    }
  }, [applyPendingTarget, play]);

  // 高级API
  const prevSentence = usePlayerState((s) => s.prevSentence);
  const nextSentence = usePlayerState((s) => s.nextSentence);
  const repeatCurrent = usePlayerState((s) => s.repeatCurrent);

  // 只读选择器（用于边界检测）
  const isAtFirstSentence = usePlayerState((s) => s.isAtFirstSentence);
  const isAtLastSentence = usePlayerState((s) => s.isAtLastSentence);

  // 当clip或forcePlayKey发生变化时，加载新的视频和字幕
  useEffect(() => {
    if (clip) {
      const videoUrl = clip.videoPath ? UrlUtil.toUrl(clip.videoPath) : '';
      setSource(videoUrl);

      const sentencesConverted = convertClipSrtLinesToSentences(clip.clipContent, clip.videoPath, clip.key);
      loadSubtitles(sentencesConverted);

      playerReadyRef.current = false;
      autoPlayRef.current = true;

      const desiredIndex = lineIdxRef.current ?? -1;
      let targetSentence: Sentence | null = null;
      if (desiredIndex >= 0 && desiredIndex < sentencesConverted.length) {
        targetSentence = sentencesConverted[desiredIndex];
      } else if (sentencesConverted.length > 0) {
        targetSentence = sentencesConverted[0];
        if (desiredIndex !== 0) {
          onLineIdxChange(0);
        }
      }

      queuePendingTarget(targetSentence);
    } else {
      setSource(null);
      clearSubtitles();
      queuePendingTarget(null);
      playerReadyRef.current = false;
      autoPlayRef.current = false;
    }
  }, [clip, forcePlayKey, setSource, loadSubtitles, clearSubtitles, onLineIdxChange, queuePendingTarget]);

  useEffect(() => {
    if (!clip) {
      clearVocabularyWords();
      return;
    }

    /**
     * 将词汇条目同步到前端词汇 store，供字幕高亮使用。
     *
     * @param entries 当前片段的词汇条目。
     */
    const syncVocabularyEntries = (entries: ClipVocabularyEntry[]) => {
      const baseWords: string[] = [];
      const formMap: Record<string, string> = {};

      entries.forEach((entry) => {
        const word = entry.word?.toLowerCase().trim();
        if (!word) {
          return;
        }
        if (!baseWords.includes(word)) {
          baseWords.push(word);
        }
        (entry.matchedForms || []).forEach((form) => {
          const normalizedForm = form?.toLowerCase().trim();
          if (normalizedForm) {
            formMap[normalizedForm] = word;
          }
        });
      });

      setVocabularyWords(baseWords);
      setVocabularyForms(formMap);
    };

    const baseVocabularyEntries = clip.vocabulary ?? [];
    syncVocabularyEntries(baseVocabularyEntries);

    const normalizedWords = baseVocabularyEntries
      .map((entry) => entry.word?.toLowerCase().trim())
      .filter((word): word is string => !!word);
    if (normalizedWords.length === 0) {
      return () => {
        clearVocabularyWords();
      };
    }

    const cachedEntries = resolvedVocabularyCacheRef.current[clip.key];
    if (cachedEntries) {
      syncVocabularyEntries(cachedEntries);
      return () => {
        clearVocabularyWords();
      };
    }

    let disposed = false;
    const resolveVocabulary = async () => {
      const result = await videoLearningApi.resolveClipVocabulary(clip.clipContent, normalizedWords);
      if (!result.success || disposed) {
        return;
      }

      resolvedVocabularyCacheRef.current[clip.key] = result.data;
      syncVocabularyEntries(result.data);
    };

    resolveVocabulary().catch(() => {
      // 保持基础词高亮即可，失败时不覆盖当前已回填的数据。
    });

    return () => {
      disposed = true;
      clearVocabularyWords();
    };
  }, [clip, setVocabularyWords, setVocabularyForms, clearVocabularyWords]);

  // 当外部 lineIdx 变化时，同步到播放器
  useEffect(() => {
    if (!clip || lineIdx < 0 || sentences.length === 0) {
      return;
    }

    if (lineIdx >= sentences.length) {
      const safeIndex = sentences.length - 1;
      if (safeIndex >= 0) {
        onLineIdxChange(safeIndex);
      }
      return;
    }

    const targetSentence = sentences[lineIdx];
    if (!targetSentence) {
      return;
    }

    const current = currentSentenceRef.current;
    const isSameSentence =
      current &&
      current.index === targetSentence.index &&
      current.fileHash === targetSentence.fileHash;

    if (isSameSentence) {
      return;
    }

    if (!playerReadyRef.current) {
      queuePendingTarget(targetSentence);
      return;
    }

    pendingHighlightRef.current = {
      fileHash: targetSentence.fileHash,
      index: targetSentence.index
    };
    seekToTarget({ time: targetSentence.start, target: targetSentence });
  }, [clip, lineIdx, sentences, onLineIdxChange, queuePendingTarget, seekToTarget]);

  // 监听当前句子的变化，同步到外部
  useEffect(() => {
    if (currentSentence && sentences.length > 0) {
      const pendingGuard = pendingHighlightRef.current;
      if (pendingGuard) {
        const matchesTarget =
          pendingGuard.index === currentSentence.index &&
          pendingGuard.fileHash === currentSentence.fileHash;
        if (!matchesTarget) {
          return;
        }
        pendingHighlightRef.current = null;
      }

      const currentIndex = sentences.findIndex(s =>
        s.index === currentSentence.index && s.fileHash === currentSentence.fileHash
      );
      if (currentIndex !== lineIdx && currentIndex >= 0) {
        onLineIdxChange(currentIndex);
      }
    }
  }, [currentSentence, sentences, lineIdx, onLineIdxChange]);

  // 视频播放结束处理
  const handlePlayerEnded = () => {
    onEnded();
  };

  // 句子导航处理边界情况
  const handlePrevSentence = () => {
    if (isAtFirstSentence()) {
      // 第一句再上一句：跳到上个视频
      onPrevSentence();
    } else {
      // 否则使用播放器内部逻辑
      prevSentence();
    }
  };

  const handleNextSentence = () => {
    if (isAtLastSentence()) {
      // 最后一句再下一句：跳到下个视频
      onNextSentence();
    } else {
      // 否则使用播放器内部逻辑
      nextSentence();
    }
  };

  // 计算当前活跃的句子索引
  const initialIndex = currentSentence && sentences.length > 0
    ? sentences.findIndex(s => s.index === currentSentence.index && s.fileHash === currentSentence.fileHash)
    : lineIdx >= 0 ? lineIdx : 0;
  const activeLineIndex = lineIdx >= 0 ? lineIdx : initialIndex;

  if (!clip) {
    // 空白骨架屏幕
    return (
      <div className="rounded-2xl border border-border/70 bg-card p-3.5 shadow-2xs">
        <div className="grid grid-cols-[320px_minmax(0,1fr)] gap-4 items-center">
          {/* 视频播放器骨架 */}
          <div>
            <AspectRatio ratio={16 / 9}>
              <div className="w-full h-full bg-muted/40 rounded-xl flex items-center justify-center border border-border/40">
                <div className="text-center text-muted-foreground">
                  <div className="w-9 h-9 bg-muted/80 rounded-full mx-auto mb-1.5 flex items-center justify-center">
                    <div className="w-4 h-4 text-muted-foreground/70">▶</div>
                  </div>
                  <p className="text-[11px]">点击上方片段开始播放</p>
                </div>
              </div>
            </AspectRatio>
          </div>

          {/* 字幕区域骨架 */}
          <div className="overflow-auto max-h-48 scrollbar-thin">
            <div className="space-y-1.5">
              {[1, 2, 3].map((i) => (
                <div key={i} className="p-2 rounded-xl bg-muted/30 border border-border/30">
                  <div className="h-2.5 bg-muted/80 rounded w-16 mb-1"></div>
                  <div className="h-3 bg-muted/80 rounded w-full mb-1"></div>
                  <div className="h-2.5 bg-muted/60 rounded w-3/4"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/70 bg-card p-3.5 shadow-2xs">
      <div className="grid grid-cols-[320px_minmax(0,1fr)] gap-4 items-center">
        <div>
          <AspectRatio ratio={16 / 9}>
            <div className="w-full rounded-xl overflow-hidden bg-black shadow-inner border border-black/10">
              <PlayerEngine
                width="100%"
                height="100%"
                onReady={handlePlayerReady}
                onEnded={handlePlayerEnded}
              />
            </div>
          </AspectRatio>
        </div>

        <div className="min-h-0">
          <SubtitleListWithProgress
            lines={clip.clipContent ?? []}
            activeIndex={activeLineIndex}
            playing={playing}
            autoPause={autoPause}
            singleRepeat={singleRepeat}
            onPickLine={(idx) => {
              // 如果点击的是当前激活的句子，重新播放
              if (idx === activeLineIndex) {
                repeatCurrent({ loop: false });
              } else {
                onLineIdxChange(idx);
              }
            }}
            onTogglePlay={togglePlay}
            onToggleAutoPause={() => setAutoPause(!autoPause)}
            onToggleSingleRepeat={() => setSingleRepeat(!singleRepeat)}
          />
        </div>
      </div>

      {/* 快捷键组件 */}
      <VideoPlayerShortcut
        onPlayPause={togglePlay}
        onPrevSentence={handlePrevSentence}
        onNextSentence={handleNextSentence}
        onRepeatSentence={() => repeatCurrent({ loop: false })}
        onChangeSingleRepeat={() => setSingleRepeat(!singleRepeat)}
        onChangeAutoPause={() => setAutoPause(!autoPause)}
      />
    </div>
  );
}
