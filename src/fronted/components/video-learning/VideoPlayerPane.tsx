import React, { useEffect, useMemo, useState } from 'react';
import UrlUtil from '@/common/utils/UrlUtil';
import SubtitleList from './SubtitleList';
import { VideoClip } from '@/fronted/hooks/useClipTender';
import { AspectRatio } from '@/fronted/components/ui/aspect-ratio';
import VideoPlayerShortcut from './VideoPlayerShortcut';
import PlayerEngineV2 from '@/fronted/components/PlayerEngineV2';
import { usePlayerV2 } from '@/fronted/hooks/usePlayerV2';
import { convertClipSrtLinesToSentences } from '@/fronted/lib/clipToSentenceConverter';
import { Button } from '@/fronted/components/ui/button';
import { RotateCcw, SkipBack, SkipForward, Play, Pause } from 'lucide-react';

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
  // 使用新的播放器状态管理
  const {
    src,
    playing,
    currentSentence,
    sentences,
    duration,
    autoPause,
    singleRepeat,
    volume,
    muted,
    playbackRate,

    // 播放控制
    play,
    pause,
    togglePlay,
    seekTo,
    setVolume,
    setMuted,
    setPlaybackRate,

    // 模式控制
    setAutoPause,
    setSingleRepeat,

    // 字幕相关
    setSource,
    loadSubtitles,
    clearSubtitles,
    mapCurrentRange,
    getExactPlayTime,

    // 高级API
    prevSentence,
    nextSentence,
    repeatCurrent,

    // 只读选择器（用于边界检测）
    isAtFirstSentence,
    isAtLastSentence
  } = usePlayerV2();

  const [ready, setReady] = useState(false);

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
        const range = { start: targetSentence.start, end: targetSentence.end };
        seekTo({ time: range.start });
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
        const range = { start: targetSentence.start, end: targetSentence.end };
        seekTo({ time: range.start });
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

  // 播放器就绪处理
  const handlePlayerReady = () => {
    setReady(true);
  };

  // 播放/暂停控制
  const handlePlayPause = () => {
    togglePlay();
  };

  // 使用新播放器的高级API，处理边界情况
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

  const handleRepeatSentence = () => {
    repeatCurrent({ loop: true });
  };

  const handleSeekToCurrentStart = () => {
    repeatCurrent({ loop: false });
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
                onReady={handlePlayerReady}
                onEnded={handlePlayerEnded}
              />
            </div>
          </AspectRatio>

          {/* 新增播放控制按钮 */}
          <div className="flex items-center justify-between mt-4 p-3 bg-gray-50 dark:bg-gray-700 rounded-lg">
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handlePlayPause}
              >
                {playing ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handlePrevSentence}
              >
                <SkipBack className="w-4 h-4" />
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleNextSentence}
              >
                <SkipForward className="w-4 h-4" />
              </Button>

              <Button
                variant="outline"
                size="sm"
                onClick={handleRepeatSentence}
              >
                <RotateCcw className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Button
                  variant={autoPause ? "default" : "outline"}
                  size="sm"
                  onClick={() => setAutoPause(!autoPause)}
                >
                  自动暂停 {autoPause ? '✓' : ''}
                </Button>

                <Button
                  variant={singleRepeat ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSingleRepeat(!singleRepeat)}
                >
                  单句循环 {singleRepeat ? '✓' : ''}
                </Button>
              </div>

              <div className="text-gray-600 dark:text-gray-400">
                {getExactPlayTime().toFixed(1)}s / {duration.toFixed(1)}s
              </div>
            </div>
          </div>
        </div>

        <div>
          <SubtitleList
            lines={clip.clipContent ?? []}
            activeIndex={initialIndex}
            onPickLine={(idx) => {
              // 如果点击的是当前激活的句子，重新播放
              if (idx === initialIndex) {
                repeatCurrent({ loop: false });
              } else {
                onLineIdxChange(idx);
              }
            }}
          />

          {/* 新功能提示 */}
          {sentences.length > 0 && (
            <div className="mt-4 p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
              <div className="text-sm text-blue-800 dark:text-blue-200">
                <div className="font-medium mb-1">💡 新功能提示</div>
                <ul className="space-y-1 text-xs">
                  <li>• 增强的播放控制：优化的自动暂停和单句循环模式</li>
                  <li>• 更精确的时间同步：改进的字幕播放同步机制</li>
                  <li>• 更好的状态管理：统一的播放器状态控制</li>
                </ul>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* 快捷键组件 */}
      <VideoPlayerShortcut
        onPlayPause={handlePlayPause}
        onPrevSentence={handlePrevSentence}
        onNextSentence={handleNextSentence}
        onRepeatSentence={handleRepeatSentence}
        onSeekToCurrentStart={handleSeekToCurrentStart}
      />
    </div>
  );
}