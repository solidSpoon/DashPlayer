import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactPlayer from 'react-player';
import UrlUtil from '@/common/utils/UrlUtil';
import SubtitleList from './SubtitleList';
import { VideoClip, useClipTender } from '@/fronted/hooks/useClipTender';
import { AspectRatio } from '@/fronted/components/ui/aspect-ratio';
import VideoPlayerShortcut from './VideoPlayerShortcut';

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
  const playerRef = useRef<ReactPlayer>(null);
  const { tender, centerIndex, pickIndexByTime } = useClipTender(clip);
  const [ready, setReady] = useState(false);
  const [playing, setPlaying] = useState(true);

  // 当clip或forcePlayKey发生变化时，确保播放状态为true
  useEffect(() => {
    if (clip) {
      setPlaying(true);
    }
  }, [clip, forcePlayKey]);

  const videoUrl = useMemo(() => {
    if (!clip) return '';
    // OSS 类型：videoPath 已经是完整路径，直接使用
    // Local 类型：videoPath 是原视频路径，直接使用
    return clip.videoPath ? UrlUtil.file(clip.videoPath) : '';
  }, [clip]);

  // 播放/暂停控制
  const handlePlayPause = () => {
    setPlaying(!playing);
  };

  // 重复当前句子
  const handleRepeatSentence = () => {
    if (!clip || lineIdx < 0) return;
    const line = clip.clipContent[lineIdx];
    if (!line) return;

    // 回到当前句子的开头重新播放
    playerRef.current?.seekTo(line.start, 'seconds');
    setPlaying(true);
  };

  // 当clip或forcePlayKey发生变化时，确保播放状态为true
  useEffect(() => {
    if (clip) {
      setPlaying(true);
    }
  }, [clip, forcePlayKey]);

  // 当前目标句发生变化 -> seek 到该句开头
  useEffect(() => {
    if (!clip || !ready || lineIdx < 0) return;
    const line = clip.clipContent[lineIdx];
    if (!line) return;

    // 检查是否是因为用户主动切换（非正常播放触发）
    const currentTime = playerRef.current?.getCurrentTime() || 0;
    const target = line.start || 0;

    // 如果时间差很小（0.5秒内），说明是正常播放，不需要 seek
    if (Math.abs(currentTime - target) < 0.5) return;

    // 只有在时间差较大时才进行 seek
    playerRef.current?.seekTo(target, 'seconds');
  }, [clip?.key, lineIdx, ready]);

  // 进度回调 -> 更新高亮
  const onProgress = (progress: { playedSeconds: number }) => {
    if (!clip) return;

    // 后端已经处理好时间，直接使用
    const idx = pickIndexByTime(progress.playedSeconds);
    if (idx !== lineIdx) onLineIdxChange(idx);
  };

  // 同一视频重复点击时，父组件会把 lineIdx 重置为 centerIndex，这里只要响应上面的 effect 即可
  const initialIndex = lineIdx >= 0 ? lineIdx : centerIndex;

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
              <ReactPlayer
                ref={playerRef}
                url={videoUrl}
                width="100%"
                height="100%"
                playing={playing}
                controls={true}
                onReady={() => setReady(true)}
                onProgress={onProgress}
                onEnded={onEnded}
              />
            </div>
          </AspectRatio>
        </div>

        <SubtitleList
          lines={clip.clipContent ?? []}
          activeIndex={initialIndex}
          onPickLine={(idx) => onLineIdxChange(idx)}
        />
      </div>

      {/* 快捷键组件 */}
      <VideoPlayerShortcut
        onPlayPause={handlePlayPause}
        onPrevSentence={onPrevSentence}
        onNextSentence={onNextSentence}
        onRepeatSentence={handleRepeatSentence}
      />
    </div>
  );
}