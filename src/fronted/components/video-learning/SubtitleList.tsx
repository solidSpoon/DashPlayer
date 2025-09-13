import React, { useEffect, useRef } from 'react';
import { ClipSrtLine } from '@/common/types/clipMeta';
import { Play, Pause, CirclePause, Repeat } from 'lucide-react';

type Props = {
  lines: ClipSrtLine[];
  activeIndex: number;
  playing?: boolean;
  autoPause?: boolean;
  singleRepeat?: boolean;
  currentTime?: number;
  duration?: number;
  onPickLine?: (idx: number) => void;
  onTogglePlay?: () => void;
  onToggleAutoPause?: () => void;
  onToggleSingleRepeat?: () => void;
};

export default function SubtitleList({
  lines,
  activeIndex,
  playing = false,
  autoPause = false,
  singleRepeat = false,
  currentTime = 0,
  duration = 0,
  onPickLine,
  onTogglePlay,
  onToggleAutoPause,
  onToggleSingleRepeat
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    const el = itemRefs.current[activeIndex];
    if (el && containerRef.current) {
      el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, [activeIndex]);

  return (
    <div ref={containerRef} className="overflow-auto max-h-64 scrollbar-thin scrollbar-track-gray-200 dark:scrollbar-track-gray-800 scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-600">
      <div className="space-y-2">
        {lines.map((line, idx) => (
          <div
            key={idx}
            ref={(r) => (itemRefs.current[idx] = r)}
            onClick={() => onPickLine?.(idx)}
            className={`p-2 rounded text-sm cursor-pointer ${
              idx === activeIndex
                ? 'bg-blue-100 dark:bg-blue-900/30 border-l-2 border-blue-500'
                : 'bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700'
            }`}
          >
            <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="text-gray-900 dark:text-gray-100">{line.contentEn}</div>
                <div className="text-gray-600 dark:text-gray-400 text-xs mt-1">{line.contentZh}</div>
              </div>

              {/* 当前行的状态图标 */}
              {idx === activeIndex && (
                <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                  {/* 播放/暂停按钮 */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onTogglePlay?.();
                    }}
                    className="p-1 rounded hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                    title={playing ? "暂停" : "播放"}
                  >
                    {playing ? (
                      <Pause className="w-3 h-3 text-gray-600 dark:text-gray-400" />
                    ) : (
                      <Play className="w-3 h-3 text-gray-600 dark:text-gray-400" />
                    )}
                  </button>

                  {/* 自动暂停状态 */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleAutoPause?.();
                    }}
                    className={`p-1 rounded transition-colors ${
                      autoPause
                        ? 'bg-blue-100 dark:bg-blue-800'
                        : 'hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                    title={autoPause ? "关闭自动暂停" : "开启自动暂停"}
                  >
                    <CirclePause className={`w-3 h-3 ${
                      autoPause
                        ? 'text-blue-600 dark:text-blue-400'
                        : 'text-gray-400 dark:text-gray-500'
                    }`} />
                  </button>

                  {/* 单句循环状态 */}
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleSingleRepeat?.();
                    }}
                    className={`p-1 rounded transition-colors ${
                      singleRepeat
                        ? 'bg-green-100 dark:bg-green-800'
                        : 'hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                    title={singleRepeat ? "关闭单句循环" : "开启单句循环"}
                  >
                    <Repeat className={`w-3 h-3 ${
                      singleRepeat
                        ? 'text-green-600 dark:text-green-400'
                        : 'text-gray-400 dark:text-gray-500'
                    }`} />
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}