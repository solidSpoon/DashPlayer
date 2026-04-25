import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { apiPath } from '@/fronted/lib/swr-util';
import { VideoLearningClipPage } from '@/common/types/vo/VideoLearningClipVO';
import { VideoClip } from './types';
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
import { Button } from '@/fronted/components/ui/button';
import toast from 'react-hot-toast';
import PageHeader from '@/fronted/components/shared/common/PageHeader';
import { useTranslation as useI18nTranslation } from 'react-i18next';

interface WordItem {
  id: number;
  word: string;
  translate: string;
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
  const { t } = useI18nTranslation('pages');
  const [selectedWord, setSelectedWord] = useState<WordItem | null>(null);
  const [words, setWords] = useState<WordItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [page, setPage] = useState(1);
  const [pendingClip, setPendingClip] = useState<PendingClipRequest | null>(null);
  const [thumbnailUrls, setThumbnailUrls] = useState<Record<string, string>>({});
  const [forcePlayKey, setForcePlayKey] = useState(0); // 用于强制播放器重新播放
  const [storageStatus, setStorageStatus] = useState<{ resolvedPath?: string } | null>(null);
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
          
          const timeA = new Date(a.updated_at || a.created_at || 0).getTime();
          const timeB = new Date(b.updated_at || b.created_at || 0).getTime();
          return timeB - timeA;
        });

        setWords(sortedWords);
      }
    } catch (error) {
      console.error('获取单词失败:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * 从本地 Vocabulary Studio 文件夹重建片段索引。
   *
   * 行为说明：
   * - 以 `word_video` 目录内元数据为准回灌数据库。
   * - 完成后刷新词汇与片段列表。
   */
  const recoverVocabularyStudio = useCallback(async (): Promise<void> => {
    await toast.promise(
      (async () => {
        const result = await backendClient.call('video-learning/sync-from-oss');
        if (!result?.success) {
          throw new Error('sync failed');
        }
        await mutate(searchKey);
        await fetchWords();
      })(),
      {
        loading: t('vocabularyStudio.recover.loading'),
        success: t('vocabularyStudio.recover.success'),
        error: t('vocabularyStudio.recover.error'),
      }
    );
  }, [fetchWords, mutate, searchKey, t]);

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
  const importWords = useCallback(async (filePath: string) => {
    setLoading(true);
    try {
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
      // 只有当不是正在加载新数据时才自动播放
      if (!isValidating) {
        playClip(0);
      }
    }
  }, [clips, currentClipIndex, loadedPage, pendingClip, playClip, setPendingClip, isValidating]);

  // 获取存储状态
  useEffect(() => {
    backendClient.call('storage/status').then(setStorageStatus).catch(console.error);
  }, []);

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

  const handleDeleteWord = useCallback(async (word: WordItem) => {
    if (!confirm(`确定要删除单词「${word.word}」及其所有学习记录吗？`)) {
        return;
    }
    const result = await backendClient.call('vocabulary/delete', { word: word.word });
    if (result.success) {
        toast.success(result.message || '已删除');
        if (selectedWord?.word === word.word) {
            setSelectedWord(null);
        }
        await fetchWords();
        await mutate(searchKey);
    } else {
        toast.error(result.message || '删除失败');
    }
  }, [selectedWord, fetchWords, mutate, searchKey]);

  const handleRefreshWord = useCallback(async (word: WordItem) => {
    const loadingToast = toast.loading('正在更新释义...');
    try {
        const result = await backendClient.call('vocabulary/refresh-translation', { word: word.word });
        if (result.success) {
            toast.success(result.message || '更新成功', { id: loadingToast });
            await fetchWords();
        } else {
            toast.error(result.message || '更新失败', { id: loadingToast });
        }
    } catch (error) {
        toast.error('请求失败', { id: loadingToast });
    }
  }, [fetchWords]);

  return (
    <div className="w-full h-full flex flex-col overflow-hidden bg-background px-6 py-4 gap-4 text-foreground">
      <PageHeader
        title={t('vocabularyStudio.title')}
        description={t('vocabularyStudio.description')}
      />

      {/* 主体内容区域 */}
      <div className="flex-1 flex overflow-hidden">
        <div className="w-80 flex-shrink-0 pr-4 border-r border-border/40">
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
            onDeleteWord={handleDeleteWord}
            onRefreshWord={handleRefreshWord}
          />
        </div>

        <div className="flex-1 flex flex-col gap-4 min-h-0 pl-6">
          <div className="flex-1 min-h-0">
            {clips.length === 0 ? (
              <div className="h-full w-full rounded-xl border border-dashed border-border/60 p-8 flex flex-col gap-4 items-start justify-center">
                <h3 className="text-xl font-semibold">{t('vocabularyStudio.empty.title')}</h3>
                <p className="text-sm text-muted-foreground leading-6">
                  {t('vocabularyStudio.empty.guideAdd')}
                </p>
                <p className="text-sm text-muted-foreground leading-6">
                  {t('vocabularyStudio.empty.guideRecover')}
                </p>
                {storageStatus?.resolvedPath && (
                  <div className="text-xs bg-muted/50 p-2 rounded border border-border/40 select-text max-w-full overflow-hidden text-ellipsis">
                    本地片段存储地址：<span className="font-mono">{storageStatus.resolvedPath}\favorite_clips\word_video</span>
                  </div>
                )}
                <Button type="button" variant="outline" onClick={recoverVocabularyStudio}>
                  {t('vocabularyStudio.recover.button')}
                </Button>
              </div>
            ) : (
              <ClipGrid
                clips={clips}
                playingKey={playingKey}
                thumbnails={thumbnailUrls}
                onClickClip={(idx) => {
                  playClip(idx);
                }}
              />
            )}
          </div>
          <div className="px-1 py-2">
            <div className="flex flex-nowrap items-center justify-between gap-3">
              <div className="text-sm text-muted-foreground tabular-nums">
                {totalClips > 0
                  ? t('vocabularyStudio.pagination.summary', {
                    start: clipRangeStart,
                    end: clipRangeEnd,
                    total: totalClips,
                  })
                  : t('vocabularyStudio.pagination.empty')}
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
