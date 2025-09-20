import React, { useEffect, memo } from 'react';
import UrlUtil from '@/common/utils/UrlUtil';
import SubtitleList from './SubtitleList';
import { VideoClip } from '@/fronted/hooks/useClipTender';
import { AspectRatio } from '@/fronted/components/ui/aspect-ratio';
import VideoPlayerShortcut from './VideoPlayerShortcut';
import { PlayerEngineV2 } from '@/fronted/components/player-components';
import { usePlayerV2 } from '@/fronted/hooks/usePlayerV2';
import { convertClipSrtLinesToSentences } from '@/fronted/lib/clipToSentenceConverter';

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
  lines: any[];
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
  const playing = usePlayerV2((s) => s.playing);
  const currentSentence = usePlayerV2((s) => s.currentSentence);
  const sentences = usePlayerV2((s) => s.sentences);
  const duration = usePlayerV2((s) => s.duration);
  const autoPause = usePlayerV2((s) => s.autoPause);
  const singleRepeat = usePlayerV2((s) => s.singleRepeat);

  console.log('VideoPlayerPane render:', {
    clipKey: clip?.key,
    playing,
    sentenceKey: currentSentence ? `${currentSentence.fileHash}-${currentSentence.index}` : null,
    timestamp: Date.now()
  });

  // 播放控制方法
  const play = usePlayerV2((s) => s.play);
  const togglePlay = usePlayerV2((s) => s.togglePlay);
  const seekToTarget = usePlayerV2((s) => s.seekToTarget);

  // 模式控制方法
  const setAutoPause = usePlayerV2((s) => s.setAutoPause);
  const setSingleRepeat = usePlayerV2((s) => s.setSingleRepeat);

  // 字幕相关方法
  const setSource = usePlayerV2((s) => s.setSource);
  const loadSubtitles = usePlayerV2((s) => s.loadSubtitles);
  const clearSubtitles = usePlayerV2((s) => s.clearSubtitles);

  // 高级API
  const prevSentence = usePlayerV2((s) => s.prevSentence);
  const nextSentence = usePlayerV2((s) => s.nextSentence);
  const repeatCurrent = usePlayerV2((s) => s.repeatCurrent);

  // 只读选择器（用于边界检测）
  const isAtFirstSentence = usePlayerV2((s) => s.isAtFirstSentence);
  const isAtLastSentence = usePlayerV2((s) => s.isAtLastSentence);

  // 当clip或forcePlayKey发生变化时，加载新的视频和字幕
  useEffect(() => {
    if (clip) {
      const videoUrl = clip.videoPath ? UrlUtil.file(clip.videoPath) : '';
      setSource(videoUrl);

      // 转换字幕格式
      const sentences = convertClipSrtLinesToSentences(clip.clipContent, clip.videoPath, clip.key);
      loadSubtitles(sentences);

      // 播放指定的句子
      if (lineIdx >= 0 && lineIdx < sentences.length) {
        const targetSentence = sentences[lineIdx];
        seekToTarget({ time: targetSentence.start, target: targetSentence });
      }

      play();
    } else {
      setSource(null);
      clearSubtitles();
    }
  }, [clip, forcePlayKey]);

  // 当外部 lineIdx 变化时，同步到播放器
  useEffect(() => {
    if (clip && lineIdx >= 0 && sentences.length > 0) {
      const targetSentence = sentences[lineIdx];
      if (targetSentence && currentSentence?.index !== targetSentence.index) {
        seekToTarget({ time: targetSentence.start, target: targetSentence });
      }
    }
  }, [lineIdx, sentences]);

  // 监听当前句子的变化，同步到外部
  useEffect(() => {
    if (currentSentence && sentences.length > 0) {
      const currentIndex = sentences.findIndex(s =>
        s.index === currentSentence.index && s.fileHash === currentSentence.fileHash
      );
      if (currentIndex !== lineIdx && currentIndex >= 0) {
        onLineIdxChange(currentIndex);
      }
    }
  }, [currentSentence, sentences]);

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

  if (!clip) {
    // 空白骨架屏幕
    return (
      <div className="p-6 bg-white dark:bg-gray-800 border-t">
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
          {/* 视频播放器骨架 */}
          <div>
            <AspectRatio ratio={16 / 9}>
              <div className="w-full h-full bg-gray-100 dark:bg-gray-700 rounded-lg flex items-center justify-center">
                <div className="text-center">
                  <div className="w-16 h-16 bg-gray-300 dark:bg-gray-600 rounded-full mx-auto mb-3 flex items-center justify-center">
                    <div className="w-8 h-8 text-gray-500 dark:text-gray-400">▶</div>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">点击上方视频开始播放</p>
                </div>
              </div>
            </AspectRatio>
          </div>

          {/* 字幕区域骨架 */}
          <div className="overflow-auto max-h-64 scrollbar-thin scrollbar-track-gray-200 dark:scrollbar-track-gray-800 scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-600">
            <div className="space-y-2">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="p-2 rounded bg-gray-50 dark:bg-gray-800">
                  <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-16 mb-1"></div>
                  <div className="h-4 bg-gray-300 dark:bg-gray-600 rounded w-full mb-1"></div>
                  <div className="h-3 bg-gray-300 dark:bg-gray-600 rounded w-3/4"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 bg-white dark:bg-gray-800 border-t">
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
        <div>
          <AspectRatio ratio={16 / 9}>
            <div className="w-full rounded-lg overflow-hidden">
              <PlayerEngineV2
                width="100%"
                height="100%"
                onEnded={handlePlayerEnded}
              />
            </div>
          </AspectRatio>
        </div>

        <div>
          <SubtitleListWithProgress
            lines={clip.clipContent ?? []}
            activeIndex={initialIndex}
            playing={playing}
            autoPause={autoPause}
            singleRepeat={singleRepeat}
            onPickLine={(idx) => {
              // 如果点击的是当前激活的句子，重新播放
              if (idx === initialIndex) {
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
        onSeekToCurrentStart={() => repeatCurrent({ loop: false })}
        onChangeSingleRepeat={() => setSingleRepeat(!singleRepeat)}
        onChangeAutoPause={() => setAutoPause(!autoPause)}
      />
    </div>
  );
}
