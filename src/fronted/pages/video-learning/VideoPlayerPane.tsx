import React, { useEffect, memo, useRef, useCallback } from 'react';
import UrlUtil from '@/common/utils/UrlUtil';
import SubtitleList from './SubtitleList';
import { VideoClip } from './types';
import { AspectRatio } from '@/fronted/components/ui/aspect-ratio';
import VideoPlayerShortcut from './VideoPlayerShortcut';
import { PlayerEngine } from '@/fronted/components/feature/player/player';
import { usePlayerState } from '@/fronted/hooks/usePlayerState';
import { convertClipSrtLinesToSentences } from '@/fronted/lib/clipToSentenceConverter';
import useVocabularyStore, { useVocabularyState } from '@/fronted/hooks/useVocabulary';
import { Sentence } from '@/common/types/SentenceC';
import { ClipSrtLine } from '@/common/types/clipMeta';
import { backendClient } from '@/fronted/application/bootstrap/backendClient';
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
      const result = await backendClient.call('video-learning/resolve-clip-vocabulary', {
        lines: clip.clipContent,
        words: normalizedWords,
      });
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

  // 加载数据库中的完整生词本词汇，确保从首页直接打开播放器也能高亮已收藏的单词
  useEffect(() => {
    const loadFullVocabulary = async () => {
      const currentWords = useVocabularyStore.getState().vocabularyWords;
      if (currentWords.length > 0) return;

      try {
        const result = await backendClient.call('vocabulary/get-all', {});
        if (result.success && result.data) {
          const savedWords = (result.data as Array<{ word: string }>)
            .map((w) => w.word?.toLowerCase().trim())
            .filter((w): w is string => !!w);
          if (savedWords.length > 0) {
            useVocabularyStore.getState().addVocabularyWords(savedWords);
          }
        }
      } catch (e) {
        // 静默失败，不影响播放
      }
    };
    void loadFullVocabulary();
  }, []);

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
      <div className="rounded-xl bg-muted/30 p-4">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {/* 视频播放器骨架 */}
          <div>
            <AspectRatio ratio={16 / 9}>
              <div className="w-full h-full bg-muted rounded-lg flex items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <div className="w-16 h-16 bg-muted/70 rounded-full mx-auto mb-3 flex items-center justify-center">
                    <div className="w-8 h-8">▶</div>
                  </div>
                  <p className="text-sm">点击上方视频开始播放</p>
                </div>
              </div>
            </AspectRatio>
          </div>

          {/* 字幕区域骨架 */}
          <div className="overflow-auto max-h-64 scrollbar-thin scrollbar-track-gray-200 dark:scrollbar-track-gray-800 scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-600">
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="p-2 rounded-lg bg-muted/60">
                  <div className="h-3 bg-muted rounded w-16 mb-1"></div>
                  <div className="h-4 bg-muted rounded w-full mb-1"></div>
                  <div className="h-3 bg-muted rounded w-3/4"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-muted/30 p-4">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div>
          <AspectRatio ratio={16 / 9}>
            <div className="w-full rounded-lg overflow-hidden bg-black">
              <PlayerEngine
                width="100%"
                height="100%"
                onReady={handlePlayerReady}
                onEnded={handlePlayerEnded}
              />
            </div>
          </AspectRatio>
        </div>

        <div>
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
