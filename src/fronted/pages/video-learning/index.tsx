import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { apiPath } from '@/fronted/lib/swr-util';
import { VideoLearningClipPage } from '@/common/types/vo/VideoLearningClipVO';
import { VideoClip } from '@/fronted/hooks/useClipTender';
import ClipGrid from '@/fronted/pages/video-learning/ClipGrid';
import VideoPlayerPane from '@/fronted/pages/video-learning/VideoPlayerPane';
import WordSidebar from '@/fronted/pages/video-learning/WordSidebar';
import { backendClient } from '@/fronted/application/bootstrap/backendClient';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious
} from '@/fronted/components/ui/pagination';

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

type PendingClipTarget = number | 'last';
type PendingClipRequest = {
  page: number;
  index: PendingClipTarget;
};

const PAGE_SIZE = 12;
const DEFAULT_LEARNING_RESPONSE: { success: true; data: VideoLearningClipPage } = {
  success: true,
  data: {
    items: [],
    total: 0,
    page: 1,
    pageSize: PAGE_SIZE
  }
};

export default function VideoLearningPage() {
  const [selectedWord, setSelectedWord] = useState<WordItem | null>(null);
  const [words, setWords] = useState<WordItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [pendingClip, setPendingClip] = useState<PendingClipRequest | null>(null);
  const [thumbnailUrls, setThumbnailUrls] = useState<Record<string, string>>({});
  const [forcePlayKey, setForcePlayKey] = useState(0); // 用于强制播放器重新播放
  const inFlightThumbsRef = useRef<Set<string>>(new Set());
  const { mutate } = useSWRConfig();

  // 播放状态管理
  const [currentClipIndex, setCurrentClipIndex] = useState(-1);
  const [currentLineIndex, setCurrentLineIndex] = useState(-1);

  const selectedWordValue = selectedWord?.word ?? '';
  const searchKey = `${apiPath('video-learning/search')}::word=${selectedWordValue}::page=${page}::size=${PAGE_SIZE}`;
  const { data: learningClips = DEFAULT_LEARNING_RESPONSE, isValidating } = useSWR(
    searchKey,
    async () => {
      return await backendClient.call('video-learning/search', {
        word: selectedWordValue,
        page,
        pageSize: PAGE_SIZE
      });
    },
    { fallbackData: DEFAULT_LEARNING_RESPONSE, keepPreviousData: true }
  );

  const clips: VideoClip[] = useMemo(() => {
    if (learningClips?.success && Array.isArray(learningClips.data.items)) {
      return learningClips.data.items as VideoClip[];
    }
    return [];
  }, [learningClips]);
  const totalClips = learningClips?.success ? learningClips.data.total : 0;
  const totalPages = totalClips > 0 ? Math.ceil(totalClips / PAGE_SIZE) : 1;
  const loadedPage = learningClips?.success ? learningClips.data.page : page;
  const displayedPage = page;
  const isPageSwitching = isValidating && loadedPage !== displayedPage;

  const canPrev = displayedPage > 1;
  const canNext = displayedPage < totalPages;
  const clipRangeStart = totalClips === 0 ? 0 : (loadedPage - 1) * PAGE_SIZE + 1;
  const clipRangeEnd = totalClips === 0 ? 0 : Math.min(loadedPage * PAGE_SIZE, totalClips);

  const {
    pages: pageNumbers,
    hasPrevGap,
    hasNextGap,
    safeTotalPages
  } = useMemo(() => {
    const maxButtons = 5;
    const safeTotal = Math.max(totalPages, 1);
    const half = Math.floor(maxButtons / 2);
    let startPage = Math.max(1, displayedPage - half);
    const endPage = Math.min(safeTotal, startPage + maxButtons - 1);
    startPage = Math.max(1, endPage - maxButtons + 1);
    const pages: number[] = [];
    for (let i = startPage; i <= endPage; i++) {
      pages.push(i);
    }
    return {
      pages,
      hasPrevGap: startPage > 1,
      hasNextGap: endPage < safeTotal,
      safeTotalPages: safeTotal
    };
  }, [displayedPage, totalPages]);

  const handlePageChange = useCallback((nextPage: number, options?: { targetIndex?: PendingClipTarget }) => {
    if (nextPage < 1 || nextPage > totalPages) {
      return;
    }
    setPendingClip({ page: nextPage, index: options?.targetIndex ?? 0 });
    setPage(nextPage);
    setCurrentClipIndex(-1);
    setCurrentLineIndex(-1);
  }, [totalPages, setPage, setCurrentClipIndex, setCurrentLineIndex, setPendingClip]);

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
    } else if (loadedPage < totalPages) {
      handlePageChange(loadedPage + 1, { targetIndex: 0 });
    }
  }, [
    currentClip,
    currentLineIndex,
    currentClipIndex,
    clips.length,
    goToLine,
    playClip,
    loadedPage,
    totalPages,
    handlePageChange
  ]);

  const prevSentence = useCallback(() => {
    const clip = currentClip;
    if (!clip) return;
    if (currentLineIndex > 0) {
      goToLine(currentLineIndex - 1);
    } else if (currentClipIndex > 0) {
      // 跨视频：上一个视频的主要句
      playClip(currentClipIndex - 1);
    } else if (loadedPage > 1) {
      handlePageChange(loadedPage - 1, { targetIndex: 'last' });
    }
  }, [
    currentClip,
    currentLineIndex,
    currentClipIndex,
    goToLine,
    playClip,
    loadedPage,
    handlePageChange
  ]);

  const onEnded = useCallback(() => {
    // 视频自然播完，行为等价"下一句"
    nextSentence();
  }, [nextSentence]);

  // 获取单词列表
  const fetchWords = useCallback(async () => {
    setLoading(true);
    try {
      const result = await backendClient.call('vocabulary/get-all', {});
      if (result.success) {
        const wordData: WordItem[] = Array.isArray(result.data) ? result.data as WordItem[] : [];

        let clipCounts: Record<string, number> = {};
        try {
          const countResult = await backendClient.call('video-learning/clip-counts', undefined);
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
      const result = await backendClient.call('vocabulary/export-template');
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
      const fileWithPath = file as File & { path?: string };
      const filePath = fileWithPath.path;
      if (!filePath) {
        alert('导入失败：无法读取文件路径');
        return;
      }

      const result = await backendClient.call('vocabulary/import', {
        filePath
      });

      if (result.success) {
        await fetchWords();
        await mutate(searchKey);
        alert(result.message || '导入成功，已同步单词管理片段');
      } else {
        alert(`导入失败：${result.error || '未知错误'}`);
      }
    } catch (error) {
      console.error('导入单词失败:', error);
      alert('导入失败，请重试');
    } finally {
      setLoading(false);
    }
  }, [fetchWords, mutate, searchKey]);

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
          const thumbnailPathOrUrl = await backendClient.call('split-video/thumbnail', {
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

  useEffect(() => {
    if (!clips.length) return;
    const initialIndices = Array.from(
      { length: Math.min(clips.length, PAGE_SIZE) },
      (_, idx) => idx
    );
    ensureThumbnails(initialIndices);
  }, [clips, ensureThumbnails]);

  // 初始化：有列表则默认播放第一个视频的中间句
  useEffect(() => {
    if (!clips.length) {
      setCurrentClipIndex(-1);
      setCurrentLineIndex(-1);
      if (pendingClip && pendingClip.page === loadedPage) {
        setPendingClip(null);
      }
      return;
    }

    if (pendingClip && pendingClip.page === loadedPage) {
      const targetIndex = pendingClip.index === 'last'
        ? clips.length - 1
        : Math.max(0, Math.min(pendingClip.index, clips.length - 1));
      playClip(targetIndex);
      setPendingClip(null);
      return;
    }

    if (currentClipIndex < 0 || currentClipIndex >= clips.length) {
      playClip(0);
    }
  }, [clips, currentClipIndex, loadedPage, pendingClip, playClip, setPendingClip]);

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
    handlePageChange(1, { targetIndex: 0 });
  }, [handlePageChange, setSelectedWord]);

  // 处理清除选择
  const handleClearSelection = useCallback(() => {
    setSelectedWord(null);
    handlePageChange(1, { targetIndex: 0 });
  }, [handlePageChange, setSelectedWord]);

  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-background px-6 pt-12 pb-6 gap-6 text-foreground">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-3">
          <div>
            <h1 className="text-3xl font-semibold leading-tight">Vocabulary Clip</h1>
            <p className="text-sm text-muted-foreground">
              聚焦生词视频片段，快速定位并回看关键句子
            </p>
          </div>
        </div>
      </div>

      {/* 主体内容区域 */}
      <div className="flex-1 flex gap-6 overflow-hidden">
        <div className="w-[420px] flex-shrink-0">
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

        <div className="flex-1 flex flex-col gap-4 min-h-0">
          <div className="flex-1 min-h-0 rounded-2xl border border-border bg-card/80 shadow-sm backdrop-blur p-4">
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
          <div className="rounded-2xl border border-border bg-card/90 px-4 py-3 shadow-sm">
            <div className="flex flex-nowrap items-center justify-between gap-3">
              <div className="text-sm text-muted-foreground tabular-nums">
                {totalClips > 0
                  ? `显示第 ${clipRangeStart}-${clipRangeEnd} 个片段，共 ${totalClips} 个`
                  : '暂无视频片段'}
              </div>
              <Pagination className="ml-auto w-auto tabular-nums">
                <PaginationContent>
                  <PaginationItem>
                    <PaginationPrevious
                      href="#"
                      aria-disabled={!canPrev || isPageSwitching}
                      className={!canPrev || isPageSwitching ? 'pointer-events-none opacity-50' : undefined}
                      onClick={(event) => {
                        event.preventDefault();
                        if (canPrev && !isPageSwitching) {
                          handlePageChange(displayedPage - 1, { targetIndex: 0 });
                        }
                      }}
                    />
                  </PaginationItem>
                  {hasPrevGap && (
                    <>
                      <PaginationItem>
                        <PaginationLink
                          href="#"
                          isActive={displayedPage === 1}
                          onClick={(event) => {
                            event.preventDefault();
                            if (displayedPage !== 1 && !isPageSwitching) {
                              handlePageChange(1, { targetIndex: 0 });
                            }
                          }}
                        >
                          1
                        </PaginationLink>
                      </PaginationItem>
                      <PaginationItem>
                        <PaginationEllipsis />
                      </PaginationItem>
                    </>
                  )}
                  {pageNumbers.map((num) => (
                    <PaginationItem key={num}>
                      <PaginationLink
                        href="#"
                        isActive={num === displayedPage}
                        onClick={(event) => {
                          event.preventDefault();
                          if (num !== displayedPage && !isPageSwitching) {
                            handlePageChange(num, { targetIndex: 0 });
                          }
                        }}
                      >
                        {num}
                      </PaginationLink>
                    </PaginationItem>
                  ))}
                  {hasNextGap && (
                    <>
                      <PaginationItem>
                        <PaginationEllipsis />
                      </PaginationItem>
                      <PaginationItem>
                        <PaginationLink
                          href="#"
                          isActive={displayedPage === safeTotalPages}
                          onClick={(event) => {
                            event.preventDefault();
                            if (displayedPage !== safeTotalPages && !isPageSwitching) {
                              handlePageChange(safeTotalPages, { targetIndex: 0 });
                            }
                          }}
                        >
                          {safeTotalPages}
                        </PaginationLink>
                      </PaginationItem>
                    </>
                  )}
                  <PaginationItem>
                    <PaginationNext
                      href="#"
                      aria-disabled={!canNext || isPageSwitching}
                      className={!canNext || isPageSwitching ? 'pointer-events-none opacity-50' : undefined}
                      onClick={(event) => {
                        event.preventDefault();
                        if (canNext && !isPageSwitching) {
                          handlePageChange(displayedPage + 1, { targetIndex: 0 });
                        }
                      }}
                    />
                  </PaginationItem>
                </PaginationContent>
              </Pagination>
            </div>
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
