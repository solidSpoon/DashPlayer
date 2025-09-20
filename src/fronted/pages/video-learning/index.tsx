import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import { Play } from 'lucide-react';
import useSWR from 'swr';
import { apiPath } from '@/fronted/lib/swr-util';
import { VideoClip } from '@/fronted/hooks/useClipTender';
import ClipGrid from '@/fronted/pages/video-learning/ClipGrid';
import VideoPlayerPane from '@/fronted/pages/video-learning/VideoPlayerPane';
import WordSidebar from '@/fronted/pages/video-learning/WordSidebar';

interface WordItem {
  id: number;
  word: string;
  stem: string;
  translate: string;
  note: string;
  created_at: string;
  updated_at: string;
  videoCount?: number;
}

export default function VideoLearningPage() {
  const [selectedWord, setSelectedWord] = useState<WordItem | null>(null);
  const [words, setWords] = useState<WordItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [thumbnailUrls, setThumbnailUrls] = useState<Record<string, string>>({});
  const [forcePlayKey, setForcePlayKey] = useState(0); // 用于强制播放器重新播放
  const inFlightThumbsRef = useRef<Set<string>>(new Set());

  // 播放状态管理
  const [currentClipIndex, setCurrentClipIndex] = useState(-1);
  const [currentLineIndex, setCurrentLineIndex] = useState(-1);

  const { data: learningClips = { success: true, data: [] }, mutate: mutateLearningClips } = useSWR(
    selectedWord
      ? `${apiPath('video-learning/search')}-${selectedWord.word}`
      : apiPath('video-learning/search'),
    async () => {
      if (selectedWord) {
        return await window.electron.call('video-learning/search', {
          word: selectedWord.word
        });
      } else {
        return await window.electron.call('video-learning/search', {
          word: ''
        });
      }
    },
    { fallbackData: { success: true, data: [] } }
  );

  const clips: VideoClip[] = useMemo(() => {
    const list = learningClips?.success ? learningClips.data : [];
    return Array.isArray(list) ? list : [];
  }, [learningClips]);

  const currentClip = useMemo(() => {
    return currentClipIndex >= 0 ? clips[currentClipIndex] : null;
  }, [clips, currentClipIndex]);

  const playingKey = currentClip?.key;

  // 播放控制函数
  const findMainSentenceIndex = useCallback((clip: VideoClip) => {
    const centerIdx = clip.clipContent.findIndex((l) => l.isClip);
    return centerIdx >= 0 ? centerIdx : Math.floor((clip.clipContent.length || 1) / 2);
  }, []);

  const playClip = useCallback((index: number) => {
    const clip = clips[index];
    if (!clip) return;
    const lineIndex = findMainSentenceIndex(clip);
    setCurrentClipIndex(index);
    setCurrentLineIndex(lineIndex);
    setForcePlayKey(prev => prev + 1);
  }, [clips, findMainSentenceIndex]);

  const goToLine = useCallback((lineIdx: number) => {
    if (!currentClip) return;
    const safe = Math.max(0, Math.min(lineIdx, currentClip.clipContent.length - 1));
    setCurrentLineIndex(safe);
  }, [currentClip]);

  const nextSentence = useCallback(() => {
    const clip = currentClip;
    if (!clip) return;
    if (currentLineIndex < clip.clipContent.length - 1) {
      goToLine(currentLineIndex + 1);
    } else if (currentClipIndex < clips.length - 1) {
      // 跨视频：下一个视频的主要句
      playClip(currentClipIndex + 1);
    }
  }, [currentClip, currentLineIndex, currentClipIndex, clips.length, goToLine, playClip]);

  const prevSentence = useCallback(() => {
    const clip = currentClip;
    if (!clip) return;
    if (currentLineIndex > 0) {
      goToLine(currentLineIndex - 1);
    } else if (currentClipIndex > 0) {
      // 跨视频：上一个视频的主要句
      playClip(currentClipIndex - 1);
    }
  }, [currentClip, currentLineIndex, currentClipIndex, goToLine, playClip]);

  const onEnded = useCallback(() => {
    // 视频自然播完，行为等价"下一句"
    nextSentence();
  }, [nextSentence]);

  // 获取单词列表
  const fetchWords = useCallback(async () => {
    setLoading(true);
    try {
      const result = await window.electron.call('vocabulary/get-all', {});
      if (result.success) {
        const wordData: WordItem[] = result.data || [];

        let clipCounts: Record<string, number> = {};
        try {
          const countResult = await window.electron.call('video-learning/clip-counts', undefined);
          if (countResult?.success && countResult.data) {
            clipCounts = countResult.data as Record<string, number>;
          }
        } catch (error) {
          console.error('获取视频片段数量失败:', error);
        }

        const wordsWithVideoCount = wordData.map((word) => {
          const lowerWord = word.word?.toLowerCase?.() ?? word.word;
          const videoCount = clipCounts[lowerWord] ?? 0;
          return {
            ...word,
            videoCount
          };
        });

        const sortedWords = wordsWithVideoCount.sort((a, b) => {
          if ((a.videoCount || 0) > 0 && (b.videoCount || 0) === 0) return -1;
          if ((a.videoCount || 0) === 0 && (b.videoCount || 0) > 0) return 1;
          if ((a.videoCount || 0) > (b.videoCount || 0)) return -1;
          if ((a.videoCount || 0) < (b.videoCount || 0)) return 1;
          return 0;
        });

        setWords(sortedWords);
      }
    } catch (error) {
      console.error('获取单词失败:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // 导出模板
  const exportTemplate = useCallback(async () => {
    try {
      const result = await window.electron.call('vocabulary/export-template');
      if (result.success) {
        // 直接使用 data URL 下载，避免手动 base64 解码
        const dataUrl = `data:application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;base64,${result.data}`;
        const a = document.createElement('a');
        a.href = dataUrl;
        a.download = '单词管理模板.xlsx';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);

        setTimeout(() => {
          alert('模板已成功下载');
        }, 100);
      } else {
        alert(`导出失败：${result.error}`);
      }
    } catch (error) {
      console.error('导出模板失败:', error);
      alert('导出失败，请重试');
    }
  }, []);

  // 导入单词
  const importWords = useCallback(async (file: File) => {
    setLoading(true);
    try {
      const result = await window.electron.call('vocabulary/import', {
        filePath: (file as any).path
      });

      if (result.success) {
        await fetchWords();
        alert('导入成功');
      } else {
        alert(`导入失败：${result.error || '未知错误'}`);
      }
    } catch (error) {
      console.error('导入单词失败:', error);
      alert('导入失败，请重试');
    } finally {
      setLoading(false);
    }
  }, [fetchWords]);

  // 仅生成可视区域缩略图（防抖）
  const ensureThumbnails = useCallback(async (visibleIndices: number[] = []) => {
    if (!visibleIndices.length) return;

    const clipsToProcess = visibleIndices
      .map((idx) => clips[idx])
      .filter((clip) => clip && !thumbnailUrls[clip.key] && !inFlightThumbsRef.current.has(clip.key));

    if (clipsToProcess.length === 0) return;

    clipsToProcess.forEach((clip) => inFlightThumbsRef.current.add(clip.key));

    try {
      const newThumbnailUrls: Record<string, string> = {};
      const tasks = clipsToProcess.map(async (clip) => {
        try {
          const startTime = clip.clipContent.find((c) => c.isClip)?.start || 0;
          const thumbnailPathOrUrl = await window.electron.call('split-video/thumbnail', {
            filePath: clip.videoPath,
            time: startTime
          });
          newThumbnailUrls[clip.key] = thumbnailPathOrUrl;
        } catch (error) {
          console.error('Failed to generate thumbnail for clip:', error);
        } finally {
          inFlightThumbsRef.current.delete(clip.key);
        }
      });

      await Promise.all(tasks);

      if (Object.keys(newThumbnailUrls).length > 0) {
        setThumbnailUrls((prev) => ({ ...prev, ...newThumbnailUrls }));
      }
    } catch (error) {
      console.error('Failed to generate thumbnails:', error);
    }
  }, [clips, thumbnailUrls]);

  // 监听学习片段数据变化 - 现在使用按需加载，注释掉全量生成
  // useEffect(() => {
  //   generateThumbnails(clips);
  // }, [clips, generateThumbnails]);

  // 初始化：有列表则默认播放第一个视频的中间句
  useEffect(() => {
    if (clips.length && currentClipIndex < 0) {
      playClip(0);
    }
  }, [clips, currentClipIndex, playClip]);

  // 初始化加载单词
  useEffect(() => {
    fetchWords();
    return () => {
      setSelectedWord(null);
    };
  }, [fetchWords]);

  // 处理单词点击
  const handleWordClick = useCallback((word: WordItem) => {
    setSelectedWord(word);
  }, []);

  // 处理清除选择
  const handleClearSelection = useCallback(() => {
    setSelectedWord(null);
  }, []);

  return (
    <div className="h-full flex flex-col bg-gray-50 dark:bg-gray-900">
      {/* 顶部操作区域 */}
      <div className="p-6 bg-white dark:bg-gray-800 border-b">
        <div className="container mx-auto">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Play className="w-6 h-6" />
              <h1 className="text-2xl font-bold">视频学习</h1>
            </div>
            <div className="flex items-center gap-4 text-sm">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 bg-yellow-600 rounded"></div>
                <span>处理中（播放原视频）</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 主体内容区域 */}
      <div className="flex-1 px-4 py-4 flex gap-4 overflow-hidden">
        <div className="w-[480px] flex-shrink-0">
          <WordSidebar
            words={words}
            loading={loading}
            selectedWord={selectedWord}
            searchTerm={searchTerm}
            onSearchChange={setSearchTerm}
            onWordClick={handleWordClick}
            onClearSelection={handleClearSelection}
            onExportTemplate={exportTemplate}
            onImportWords={importWords}
          />
        </div>

        <div className="flex-1 flex flex-col">
          <div className="flex-1 min-h-0 p-4">
            <ClipGrid
              clips={clips}
              playingKey={playingKey}
              thumbnails={thumbnailUrls}
              onClickClip={(idx) => {
                playClip(idx);
              }}
              ensureThumbnails={ensureThumbnails}
            />
          </div>

          <VideoPlayerPane
            clip={currentClip}
            lineIdx={currentLineIndex}
            onLineIdxChange={goToLine}
            onPrevSentence={prevSentence}
            onNextSentence={nextSentence}
            onEnded={onEnded}
            forcePlayKey={forcePlayKey}
          />
        </div>
      </div>
    </div>
  );
}
