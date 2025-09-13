import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/fronted/components/ui/button';
import { Play } from 'lucide-react';
import useSWR from 'swr';
import { apiPath } from '@/fronted/lib/swr-util';
import { usePlaylist } from '@/fronted/hooks/usePlaylist';
import { VideoClip } from '@/fronted/hooks/useClipTender';
import ClipGrid from '@/fronted/components/video-learning/ClipGrid';
import VideoPlayerPane from '@/fronted/components/video-learning/VideoPlayerPane';
import WordSidebar from '@/fronted/components/video-learning/WordSidebar';

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

  const { data: learningClips = [], mutate: mutateLearningClips } = useSWR(
    selectedWord
      ? `${apiPath('video-learning/search')}-${selectedWord.word}`
      : apiPath('video-learning/search'),
    async () => {
      if (selectedWord) {
        return await window.electron.call('video-learning/search', {
          keyword: '',
          keywordRange: 'clip',
          date: { from: undefined, to: undefined },
          matchedWord: selectedWord.word
        });
      } else {
        return await window.electron.call('video-learning/search', {
          keyword: '',
          keywordRange: 'clip',
          date: { from: undefined, to: undefined }
        });
      }
    },
    { fallbackData: [] }
  );

  const clips: VideoClip[] = useMemo(() => {
    const list = learningClips?.success ? learningClips.data : [];
    return Array.isArray(list) ? list.slice(0, 20) : [];
  }, [learningClips]);

  const playlist = usePlaylist(clips);
  const playingKey = playlist.currentClip?.key;

  // 获取单词列表
  const fetchWords = useCallback(async () => {
    setLoading(true);
    try {
      const result = await window.electron.call('vocabulary/get-all', {});
      if (result.success) {
        const wordData = result.data || [];
        // 为每个单词获取视频数量
        const wordsWithVideoCount = await Promise.all(
          wordData.map(async (word: WordItem) => {
            try {
              const videoResult = await window.electron.call('video-learning/search', {
                keyword: '',
                keywordRange: 'clip',
                date: { from: undefined, to: undefined },
                matchedWord: word.word
              });
              return {
                ...word,
                videoCount:
                  videoResult.success && Array.isArray(videoResult.data)
                    ? videoResult.data.length
                    : 0
              };
            } catch (error) {
              console.error(`获取单词 ${word.word} 的视频数量失败:`, error);
              return { ...word, videoCount: 0 };
            }
          })
        );

        // 按视频数量排序，有视频的放前面
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
      const result = await window.electron.call('vocabulary/export-template', {});
      if (result.success) {
        const binaryString = atob(result.data);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        const blob = new Blob([bytes], {
          type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = '单词管理模板.xlsx';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        setTimeout(() => {
          alert('模板已成功导出到下载文件夹');
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

  // 生成缩略图
  const generateThumbnails = useCallback(async (clips: VideoClip[]) => {
    const clipsWithoutThumbnails = clips.filter((clip) => !thumbnailUrls[clip.key]);
    if (clipsWithoutThumbnails.length === 0) return;

    const newThumbnailUrls: Record<string, string> = {};

    for (const clip of clipsWithoutThumbnails) {
      try {
        // OSS 类型：如果存在 baseDir 和 clipFile，尝试从 OSS 生成缩略图
        // Local 类型：使用原视频路径
        const startTime = clip.clipContent.find((c) => c.isClip)?.start || 0;
        const thumbnailPathOrUrl = await window.electron.call('split-video/thumbnail', {
          filePath: clip.videoPath,
          time: startTime
        });
        newThumbnailUrls[clip.key] = thumbnailPathOrUrl;
      } catch (error) {
        console.error('Failed to generate thumbnail for clip:', error);
      }
    }

    if (Object.keys(newThumbnailUrls).length > 0) {
      setThumbnailUrls((prev) => ({ ...prev, ...newThumbnailUrls }));
    }
  }, [thumbnailUrls]);

  // 监听学习片段数据变化
  useEffect(() => {
    generateThumbnails(clips);
  }, [clips, generateThumbnails]);

  // 初始化：有列表则默认播放第一个视频的中间句
  useEffect(() => {
    if (clips.length && (playlist.state.clipIdx < 0)) {
      playlist.playCenterOf(0);
    }
  }, [clips, playlist.state.clipIdx, playlist]);

  // 初始化加载单词
  useEffect(() => {
    fetchWords();
  }, [fetchWords]);

  // 处理单词点击
  const handleWordClick = useCallback((word: WordItem) => {
    setSelectedWord(word);
    mutateLearningClips();
  }, [mutateLearningClips]);

  // 处理清除选择
  const handleClearSelection = useCallback(() => {
    setSelectedWord(null);
    mutateLearningClips();
  }, [mutateLearningClips]);

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
          <div className="flex-1 overflow-auto p-4">
            <ClipGrid
              clips={clips}
              playingKey={playingKey}
              thumbnails={thumbnailUrls}
              onClickClip={(idx) => playlist.onClipClick(idx)}
            />
          </div>

          <VideoPlayerPane
            clip={playlist.currentClip}
            lineIdx={playlist.state.lineIdx}
            onLineIdxChange={(idx) => playlist.goToLine(idx)}
            onPrevSentence={playlist.prevSentence}
            onNextSentence={playlist.nextSentence}
            onEnded={playlist.onEnded}
          />
        </div>
      </div>
    </div>
  );
}