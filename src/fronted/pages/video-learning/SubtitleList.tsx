import React, { useEffect, useRef, useCallback } from 'react';
import { ClipSrtLine } from '@/common/types/clipMeta';
import { Play, Pause, CirclePause, Repeat } from 'lucide-react';
import useVocabulary from '@/fronted/hooks/useVocabulary';

type Props = {
  lines: ClipSrtLine[];
  activeIndex: number;
  playing?: boolean;
  autoPause?: boolean;
  singleRepeat?: boolean;
  onPickLine?: (idx: number) => void;
  onTogglePlay?: () => void;
  onToggleAutoPause?: () => void;
  onToggleSingleRepeat?: () => void;
};

const SPLIT_REGEX =
  /((?<=.)(?=[^A-Za-z0-9\u4e00-\u9fa5-]))|((?<=[^A-Za-z0-9\u4e00-\u9fa5-])(?=.))/;

export default function SubtitleList({
  lines,
  activeIndex,
  playing = false,
  autoPause = false,
  singleRepeat = false,
  onPickLine,
  onTogglePlay,
  onToggleAutoPause,
  onToggleSingleRepeat
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const { vocabularyVersion, isVocabularyWord } = useVocabulary((state) => ({
    vocabularyVersion: state.version,
    isVocabularyWord: state.isVocabularyWord
  }));

  useEffect(() => {
    const el = itemRefs.current[activeIndex];
    if (el && containerRef.current) {
      el.scrollIntoView({ behavior: 'auto', block: 'center' });
    }
  }, [activeIndex]);

  const renderHighlightedText = useCallback((text: string, keyPrefix: string) => {
    if (!text) {
      return null;
    }
    const textHashBase = `${keyPrefix}-${vocabularyVersion}`;
    const tokens = text
      .replace(/\s+/g, ' ')
      .split(SPLIT_REGEX)
      .filter((token) => token);
    return tokens.map((token, index) => {
      const cleanToken = token.toLowerCase().replace(/[^\w-]/g, '');
      const isVocab = cleanToken && isVocabularyWord(cleanToken);
      if (isVocab) {
        return (
          <span
            key={`${textHashBase}-${index}`}
            className="text-primary font-semibold underline decoration-primary/70 decoration-1 bg-primary/10 px-0.5 rounded-sm"
          >
            {token}
          </span>
        );
      }
      return (
        <span key={`${textHashBase}-${index}`}>
          {token}
        </span>
      );
    });
  }, [isVocabularyWord, vocabularyVersion]);

  return (
    <div ref={containerRef} className="overflow-auto max-h-64 scrollbar-thin scrollbar-track-gray-200 dark:scrollbar-track-gray-800 scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-600">
      <div className="space-y-2">
        {lines.map((line, idx) => (
          <div
            key={idx}
            ref={(r) => (itemRefs.current[idx] = r)}
            onClick={() => onPickLine?.(idx)}
            className={`p-2 rounded-lg text-sm cursor-pointer border transition-colors ${
              idx === activeIndex
                ? 'bg-primary/10 border-primary/40'
                : line.isClip
                  ? 'bg-secondary/10 border-secondary/40 hover:bg-secondary/20'
                  : 'bg-muted/50 border-transparent hover:bg-muted/70'
            }`}
          >
              <div className="flex items-start justify-between">
              <div className="flex-1 min-w-0">
                <div className="text-sm text-foreground">
                  {renderHighlightedText(line.contentEn, `${idx}-${line.index}`)}
                </div>
                <div className="text-xs text-muted-foreground mt-1">{line.contentZh}</div>
              </div>

              {/* 当前行的状态图标 */}
              <div className="flex items-center gap-1 ml-2 flex-shrink-0">
                {idx === activeIndex ? (
                  <>
                    {/* 播放/暂停按钮 */}
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onTogglePlay?.();
                      }}
                      className="p-1 rounded hover:bg-muted transition-colors"
                      title={playing ? "暂停" : "播放"}
                    >
                      {playing ? (
                        <Pause className="w-3 h-3 text-muted-foreground" />
                      ) : (
                        <Play className="w-3 h-3 text-muted-foreground" />
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
                          ? 'bg-primary/10'
                          : 'hover:bg-muted'
                      }`}
                      title={autoPause ? "关闭自动暂停" : "开启自动暂停"}
                    >
                      <CirclePause className={`w-3 h-3 ${
                        autoPause
                          ? 'text-primary'
                          : 'text-muted-foreground'
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
                          ? 'bg-emerald-100 dark:bg-emerald-900/30'
                          : 'hover:bg-muted'
                      }`}
                      title={singleRepeat ? "关闭单句循环" : "开启单句循环"}
                    >
                      <Repeat className={`w-3 h-3 ${
                        singleRepeat
                          ? 'text-emerald-600 dark:text-emerald-300'
                          : 'text-muted-foreground'
                      }`} />
                    </button>
                  </>
                ) : (
                  // 非当前行：隐藏的按钮保持布局稳定
                  <div className="flex items-center gap-1 opacity-0">
                    <button className="p-1 w-6 h-6">
                      <Play className="w-3 h-3" />
                    </button>
                    <button className="p-1 w-6 h-6">
                      <CirclePause className="w-3 h-3" />
                    </button>
                    <button className="p-1 w-6 h-6">
                      <Repeat className="w-3 h-3" />
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
