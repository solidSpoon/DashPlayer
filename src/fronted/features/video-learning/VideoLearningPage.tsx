import React, { useCallback, useEffect, useMemo, useState, useRef } from 'react';
import useSWR, { useSWRConfig } from 'swr';
import { apiPath } from '@/fronted/lib/swr-util';
import { VideoLearningClipPage } from '@/common/types/vo/VideoLearningClipVO';
import { VideoClip } from './types';
import ClipGrid from '@/fronted/features/video-learning/components/ClipGrid';
import VideoPlayerPane from '@/fronted/features/video-learning/components/VideoPlayerPane';
import WordSidebar, { WordItem } from '@/fronted/features/video-learning/components/WordSidebar';
import WordEditDialog from '@/fronted/features/video-learning/components/WordEditDialog';
import { videoLearningApi } from '@/fronted/features/video-learning/videoLearningApi';
import { getRendererLogger } from '@/fronted/log/simple-logger';
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
import { cn } from '@/fronted/lib/utils';

const logger = getRendererLogger('VideoLearning');
import PageHeader from '@/fronted/components/shared/common/PageHeader';
import { useTranslation as useI18nTranslation } from 'react-i18next';

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
  // 正在编辑的单词；null 表示编辑弹窗关闭
  const [editingWord, setEditingWord] = useState<WordItem | null>(null);
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
      return await videoLearningApi.search({
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

  /**
   * 仅选中片段（加载到播放器但不自动播放）。
   *
   * 用于进入页面、切换单词或翻页等场景：只有用户明确点击片段卡片时才出声。
   *
   * @param index 片段在当前页列表中的下标。
   */
  const selectClip = useCallback((index: number) => {
    const clip = clips[index];
    if (!clip) return;
    setCurrentClipIndex(index);
    setCurrentLineIndex(findMainSentenceIndex(clip));
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
      const result = await videoLearningApi.getVocabulary();
      if (result.success) {
        const wordData: WordItem[] = Array.isArray(result.data) ? result.data as WordItem[] : [];

        let clipStats: Record<string, { count: number; lastAddedAt: string }> = {};
        try {
          const statsResult = await videoLearningApi.getWordClipStats();
          if (statsResult?.success && statsResult.data) {
            clipStats = statsResult.data as Record<string, { count: number; lastAddedAt: string }>;
          }
        } catch (error) {
          logger.error('获取视频片段统计失败', { error });
        }

        const wordsWithVideoCount = wordData.map((word) => {
          const lowerWord = word.word?.toLowerCase?.() ?? word.word;
          const stat = clipStats[lowerWord];
          return {
            ...word,
            videoCount: stat?.count ?? 0,
            lastClipAddedAt: stat?.lastAddedAt || null
          };
        });

        setWords(wordsWithVideoCount);
      }
    } catch (error) {
      logger.error('获取单词失败', { error });
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
        const result = await videoLearningApi.syncFromOss();
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
      const result = await videoLearningApi.exportVocabularyTemplate();
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
      logger.error('导出模板失败', { error });
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

      const result = await videoLearningApi.importVocabulary(filePath);

      if (result.success) {
        await fetchWords();
        await mutate(searchKey);
        alert(result.message || '导入成功，已同步单词管理片段');
      } else {
        alert(`导入失败：${result.error || '未知错误'}`);
      }
    } catch (error) {
      logger.error('导入单词失败', { error });
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
          const thumbnailPathOrUrl = await videoLearningApi.getThumbnail(clip.videoPath, startTime);
          newThumbnailUrls[clip.key] = thumbnailPathOrUrl;
        } catch (error) {
          logger.error('Failed to generate thumbnail for clip', { error });
        } finally {
          inFlightThumbsRef.current.delete(clip.key);
        }
      });

      await Promise.all(tasks);

      if (Object.keys(newThumbnailUrls).length > 0) {
        setThumbnailUrls((prev) => ({ ...prev, ...newThumbnailUrls }));
      }
    } catch (error) {
      logger.error('Failed to generate thumbnails', { error });
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
    const timer = window.setTimeout(() => ensureThumbnails(initialIndices), 0);
    return () => window.clearTimeout(timer);
  }, [clips, ensureThumbnails]);

  // 初始化：有列表则默认选中第一个视频（不自动播放），用户点击片段卡片后才出声
  useEffect(() => {
    if (!clips.length) {
      const timer = window.setTimeout(() => {
        setCurrentClipIndex(-1);
        setCurrentLineIndex(-1);
      }, 0);
      if (pendingClip && pendingClip.page === loadedPage) {
        window.setTimeout(() => setPendingClip(null), 0);
      }
      return () => window.clearTimeout(timer);
    }

    if (pendingClip && pendingClip.page === loadedPage) {
      const targetIndex = pendingClip.index === 'last'
        ? clips.length - 1
        : Math.max(0, Math.min(pendingClip.index, clips.length - 1));
      window.setTimeout(() => selectClip(targetIndex), 0);
      window.setTimeout(() => setPendingClip(null), 0);
      return;
    }

    if (currentClipIndex < 0 || currentClipIndex >= clips.length) {
      window.setTimeout(() => selectClip(0), 0);
    }
  }, [clips, currentClipIndex, loadedPage, pendingClip, selectClip, setPendingClip]);

  // 初始化加载单词
  useEffect(() => {
    const timer = window.setTimeout(() => fetchWords(), 0);
    return () => {
      window.clearTimeout(timer);
      window.setTimeout(() => setSelectedWord(null), 0);
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

  /**
   * 编辑弹窗保存成功后刷新列表，并在编辑了选中词时同步选中态。
   *
   * @param newWord 保存后的单词（后端已小写化）。
   */
  const handleWordSaved = useCallback(async (newWord: string) => {
    const editedId = editingWord?.id;
    setSelectedWord((prev) => (prev && editedId != null && prev.id === editedId ? { ...prev, word: newWord } : prev));
    setEditingWord(null);
    await fetchWords();
    await mutate(searchKey);
  }, [editingWord, fetchWords, mutate, searchKey]);

  /**
   * 单词删除成功后刷新列表，并清除指向被删单词的选中态。
   *
   * @param deleted 被删除的单词。
   */
  const handleWordDeleted = useCallback(async (deleted: WordItem) => {
    setSelectedWord((prev) => (prev && prev.id === deleted.id ? null : prev));
    await fetchWords();
    await mutate(searchKey);
  }, [fetchWords, mutate, searchKey]);

  return (
    <div className="w-full h-full flex flex-col overflow-hidden select-none bg-background text-foreground">
      {/* 顶栏标题区：统一排版 */}
      <div className="px-6 pt-5 pb-2">
        <PageHeader
          title={t('vocabularyStudio.title')}
          description={t('vocabularyStudio.description')}
        />
      </div>

      {/* 主体内容区域：双栏现代化卡片工作台 */}
      <div className="flex-1 min-h-0 grid grid-cols-[480px_minmax(0,1fr)] gap-5 px-6 pb-5 pt-1 overflow-hidden">
        {/* 左栏卡片：生词库 */}
        <div className="flex flex-col rounded-2xl border border-border/70 bg-card p-4 shadow-2xs min-h-0">
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
            onEditWord={setEditingWord}
            onWordDeleted={handleWordDeleted}
          />
        </div>

        {/* 右栏工作区：片段探索与即时播放 */}
        <div className="flex-1 flex flex-col gap-4 min-h-0 overflow-hidden">
          {/* 上半部分：片段浏览卡片 */}
          <div className="flex-1 min-h-0 flex flex-col rounded-2xl border border-border/70 bg-card p-4 shadow-2xs">
            {/* 片段卡片头部栏：统计与紧凑分页 */}
            <div className="flex items-center justify-between pb-3 mb-2 border-b border-border/40 shrink-0">
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-foreground tracking-tight">
                  {selectedWord ? `${selectedWord.word}` : t('vocabularyStudio.title')}
                </span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {totalClips > 0
                    ? t('vocabularyStudio.pagination.summary', {
                      start: clipRangeStart,
                      end: clipRangeEnd,
                      total: totalClips,
                    })
                    : t('vocabularyStudio.pagination.empty')}
                </span>
              </div>

              {totalPages > 1 && (
                <Pagination className="ml-auto w-auto tabular-nums">
                  <PaginationContent className="gap-1">
                    <PaginationItem>
                      <PaginationPrevious
                        href="#"
                        aria-disabled={!canPrev || isPageSwitching}
                        className={cn(
                          'h-7 px-2 text-xs rounded-lg',
                          (!canPrev || isPageSwitching) && 'pointer-events-none opacity-40'
                        )}
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
                            className="h-7 w-7 text-xs rounded-lg"
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
                          <PaginationEllipsis className="h-7 w-7" />
                        </PaginationItem>
                      </>
                    )}
                    {pageNumbers.map((num) => (
                      <PaginationItem key={num}>
                        <PaginationLink
                          href="#"
                          isActive={num === displayedPage}
                          className="h-7 w-7 text-xs rounded-lg"
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
                          <PaginationEllipsis className="h-7 w-7" />
                        </PaginationItem>
                        <PaginationItem>
                          <PaginationLink
                            href="#"
                            isActive={displayedPage === safeTotalPages}
                            className="h-7 w-7 text-xs rounded-lg"
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
                        className={cn(
                          'h-7 px-2 text-xs rounded-lg',
                          (!canNext || isPageSwitching) && 'pointer-events-none opacity-40'
                        )}
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
              )}
            </div>

            <div className="flex-1 min-h-0 overflow-auto">
              {clips.length === 0 ? (
                <div className="h-full w-full rounded-xl border border-dashed border-border/60 p-8 flex flex-col gap-4 items-center justify-center text-center">
                  <h3 className="text-base font-semibold">{t('vocabularyStudio.empty.title')}</h3>
                  <p className="text-xs text-muted-foreground leading-5 max-w-sm">
                    {t('vocabularyStudio.empty.guideAdd')}
                  </p>
                  <Button type="button" size="sm" variant="outline" className="text-xs h-8" onClick={recoverVocabularyStudio}>
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
          </div>

          {/* 下半部分：内嵌播放器面板 */}
          <div className="shrink-0">
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

      <WordEditDialog
        open={!!editingWord}
        wordItem={editingWord}
        onOpenChange={(open) => {
          if (!open) {
            setEditingWord(null);
          }
        }}
        onSaved={handleWordSaved}
      />
    </div>
  );
}
