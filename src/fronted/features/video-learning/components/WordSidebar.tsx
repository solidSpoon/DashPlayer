import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Input } from '@/fronted/components/ui/input';
import { Button } from '@/fronted/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@/fronted/components/ui/select';
import { Search, Upload, Download, List, LocateFixed, Pencil, Trash2, Loader2, ArrowUpDown } from 'lucide-react';
import toast from 'react-hot-toast';
import { cn } from '@/fronted/lib/utils';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/fronted/components/ui/tooltip';
import { videoLearningApi } from '@/fronted/features/video-learning/videoLearningApi';
import TimeUtil from '@/common/utils/TimeUtil';
import { useTranslation } from 'react-i18next';

export interface WordItem {
  id: number;
  word: string;
  translate: string;
  created_at: string;
  updated_at: string;
  videoCount?: number;
  /** 最近一次被添加视频（生成关联片段）的时间；没有关联片段时为 null。 */
  lastClipAddedAt?: string | null;
}

/** 单词列表排序方式。 */
type SortMode = 'usage' | 'alphabetical' | 'recentVideo';

/** 删除确认态自动复位等待时间（毫秒）。 */
const DELETE_CONFIRM_RESET_MS = 3000;

interface WordDeleteButtonProps {
  /** 所在行是否处于选中态，用于配色适配。 */
  active: boolean;
  /** 删除请求是否进行中。 */
  deleting: boolean;
  /** 第二次点击确认后触发。 */
  onConfirm: () => void;
}

/**
 * 原地两次点击确认的删除按钮。
 *
 * 行为说明：
 * - 首次点击进入待确认态并变红显示确认文案；
 * - 超时未再次点击会自动复位；
 * - 再次点击才真正触发删除。
 */
function WordDeleteButton({ active, deleting, onConfirm }: WordDeleteButtonProps) {
  const { t } = useTranslation('common');
  const [armed, setArmed] = useState(false);

  useEffect(() => {
    if (!armed) return;
    const timer = window.setTimeout(() => setArmed(false), DELETE_CONFIRM_RESET_MS);
    return () => window.clearTimeout(timer);
  }, [armed]);

  const handleClick = (event: React.MouseEvent) => {
    event.stopPropagation();
    if (deleting) return;
    if (!armed) {
      setArmed(true);
      return;
    }
    setArmed(false);
    onConfirm();
  };

  if (armed || deleting) {
    return (
      <button
        type="button"
        onClick={handleClick}
        disabled={deleting}
        className={cn(
          'px-1.5 py-0.5 rounded-md text-[10px] leading-none font-medium shrink-0 transition-colors cursor-pointer',
          'bg-destructive text-destructive-foreground hover:bg-destructive/90',
          deleting && 'opacity-60 cursor-not-allowed'
        )}
        title={t('deleteWord')}
      >
        {deleting ? <Loader2 className="w-3 h-3 animate-spin" /> : t('confirmDelete')}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      className={cn(
        'p-1 rounded-md transition-all cursor-pointer shrink-0',
        'text-muted-foreground hover:text-destructive hover:bg-destructive/10',
        active ? 'text-primary-foreground/70 hover:text-primary-foreground' : 'opacity-0 group-hover:opacity-100'
      )}
      title={t('deleteWord')}
    >
      <Trash2 className="w-3.5 h-3.5" />
    </button>
  );
}

type Props = {
  words: WordItem[];
  loading: boolean;
  selectedWord: WordItem | null;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  onWordClick: (word: WordItem) => void;
  onClearSelection: () => void;
  onExportTemplate: () => void;
  onImportWords: (filePath: string) => void;
  /** 请求编辑某个单词，由页面负责打开编辑弹窗。 */
  onEditWord: (word: WordItem) => void;
  /** 某个单词删除成功后的回调。 */
  onWordDeleted: (word: WordItem) => void;
};

export default function WordSidebar({
  words,
  loading,
  selectedWord,
  searchTerm,
  onSearchChange,
  onWordClick,
  onClearSelection,
  onExportTemplate,
  onImportWords,
  onEditWord,
  onWordDeleted,
}: Props) {
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const { t } = useTranslation('common');
  const [sortMode, setSortMode] = useState<SortMode>('usage');
  // 正在执行删除请求的单词 id，用于按钮转圈与防重复提交
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const displayedWords = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    const filtered = term
      ? words.filter((word) =>
        word.word.toLowerCase().includes(term) ||
        word.translate?.toLowerCase().includes(term)
      )
      : words;

    const sorted = [...filtered];
    if (sortMode === 'alphabetical') {
      sorted.sort((a, b) => a.word.localeCompare(b.word));
    } else if (sortMode === 'recentVideo') {
      sorted.sort((a, b) => {
        const aAt = a.lastClipAddedAt ?? '';
        const bAt = b.lastClipAddedAt ?? '';
        // 没有关联片段的单词沉底
        if (!aAt && !bAt) return a.word.localeCompare(b.word);
        if (!aAt) return 1;
        if (!bAt) return -1;
        const diff = bAt.localeCompare(aAt);
        return diff !== 0 ? diff : a.word.localeCompare(b.word);
      });
    } else {
      sorted.sort((a, b) => {
        const diff = (b.videoCount || 0) - (a.videoCount || 0);
        return diff !== 0 ? diff : a.word.localeCompare(b.word);
      });
    }
    return sorted;
  }, [words, searchTerm, sortMode]);

  const handleImportClick = async () => {
    const selectedFiles = await videoLearningApi.selectVocabularyFile();
    const filePath = selectedFiles?.[0];
    if (!filePath) {
      return;
    }
    onImportWords(filePath);
  };

  const handleShowAll = () => {
    onClearSelection();
  };

  const handleLocateCurrent = () => {
    if (!selectedWord) return;
    const targetIndex = displayedWords.findIndex((word) => word.id === selectedWord.id);
    if (targetIndex >= 0) {
      virtuosoRef.current?.scrollToIndex({ index: targetIndex, align: 'center', behavior: 'smooth' });
    }
  };

  /** 删除确认后调用后端删除并回调页面刷新。 */
  const handleDeleteConfirmed = async (word: WordItem) => {
    setDeletingId(word.id);
    try {
      const result = await videoLearningApi.deleteWord(word.word);
      if (result.success) {
        onWordDeleted(word);
      } else {
        toast.error(result.error || t('wordDeleteFailed'));
      }
    } catch {
      toast.error(t('wordDeleteFailed'));
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="h-full flex flex-col min-h-0">
      {/* 顶部工具栏 */}
      <div className="pb-3 space-y-2.5 shrink-0 border-b border-border/40">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            className="pl-9 h-9 text-xs rounded-xl bg-muted/30 focus-visible:bg-background border-border/50 transition-colors"
            placeholder={t('wordSearch')}
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        <TooltipProvider>
          <div className="flex items-center justify-between gap-1 text-xs text-muted-foreground pt-0.5">
            <div className="text-xs font-medium text-muted-foreground tabular-nums">
              {t('wordCount', { count: words.length })}
              {searchTerm && <span className="ml-1.5 text-primary">({t('foundWords', { count: displayedWords.length })})</span>}
            </div>
            <div className="flex items-center gap-1">
              <Select value={sortMode} onValueChange={(value) => setSortMode(value as SortMode)}>
                <SelectTrigger
                  className="h-7 w-auto gap-1 rounded-lg px-2 text-xs text-muted-foreground"
                  aria-label={t('sortMode')}
                >
                  <ArrowUpDown className="w-3 h-3" />
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="usage">{t('sortByUsage')}</SelectItem>
                  <SelectItem value="alphabetical">{t('sortAlphabetical')}</SelectItem>
                  <SelectItem value="recentVideo">{t('sortByRecentVideo')}</SelectItem>
                </SelectContent>
              </Select>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
                    aria-label={t('exportTemplate')}
                    type="button"
                    onClick={onExportTemplate}
                  >
                    <Download className="w-3.5 h-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('exportTemplate')}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
                    aria-label={t('importExcel')}
                    type="button"
                    onClick={handleImportClick}
                  >
                    <Upload className="w-3.5 h-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('importExcel')}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant={selectedWord ? 'ghost' : 'secondary'}
                    size="icon"
                    className="h-7 w-7 rounded-lg"
                    aria-label={t('showAllVideos')}
                    type="button"
                    onClick={handleShowAll}
                  >
                    <List className="w-3.5 h-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('showAllVideos')}</TooltipContent>
              </Tooltip>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-7 w-7 rounded-lg text-muted-foreground hover:text-foreground"
                    aria-label={t('locateCurrentWord')}
                    type="button"
                    onClick={handleLocateCurrent}
                    disabled={!selectedWord}
                  >
                    <LocateFixed className="w-3.5 h-3.5" />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{t('locateCurrentWord')}</TooltipContent>
              </Tooltip>
            </div>
          </div>
        </TooltipProvider>
      </div>

      {/* 列表区域：使用虚拟列表，占满剩余高度 */}
      <div className="flex-1 min-h-0 pt-2">
        {loading ? (
          <div className="flex items-center justify-center h-32 text-xs text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-3.5 w-3.5 border-2 border-primary border-t-transparent"></div>
              {t('loading')}
            </div>
          </div>
        ) : displayedWords.length === 0 ? (
          <div className="text-center text-muted-foreground py-10 text-xs">
            {searchTerm ? t('noMatchingWords') : t('noVocabulary')}
          </div>
        ) : (
          <Virtuoso
            ref={virtuosoRef}
            style={{ height: '100%' }}
            className="scrollbar-thin"
            data={displayedWords}
            increaseViewportBy={200}
            itemContent={(index, word) => {
              const active = selectedWord?.id === word.id;
              return (
                <div
                  role="button"
                  tabIndex={0}
                  className={[
                    'group px-3 py-2 rounded-xl cursor-pointer transition-all text-xs mb-1.5 flex flex-col gap-0.5',
                    active
                      ? 'bg-primary text-primary-foreground font-medium shadow-2xs'
                      : 'hover:bg-muted/60 text-foreground'
                  ].join(' ')}
                  onClick={() => onWordClick(word)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      onWordClick(word);
                    }
                  }}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <div className="font-semibold text-sm tracking-tight truncate">{word.word}</div>
                    <div className="flex items-center gap-0.5 shrink-0 ml-auto">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onEditWord(word);
                        }}
                        className={cn(
                          'p-1 rounded-md transition-all cursor-pointer shrink-0',
                          active
                            ? 'text-primary-foreground/70 hover:text-primary-foreground hover:bg-primary-foreground/10'
                            : 'text-muted-foreground hover:text-foreground hover:bg-muted/80 opacity-0 group-hover:opacity-100'
                        )}
                        title={t('editWord')}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </button>
                      <WordDeleteButton
                        active={active}
                        deleting={deletingId === word.id}
                        onConfirm={() => handleDeleteConfirmed(word)}
                      />
                      {!!word.videoCount && word.videoCount > 0 && (
                        <div
                          className={[
                            'text-[11px] px-1.5 py-0.5 rounded-md font-medium shrink-0 tabular-nums',
                            active
                              ? 'bg-primary-foreground/20 text-primary-foreground'
                              : 'bg-muted text-muted-foreground'
                          ].join(' ')}
                        >
                          {t('videoCount', { count: word.videoCount })}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className={['flex items-center gap-1.5 text-xs', active ? 'text-primary-foreground/80' : 'text-muted-foreground'].join(' ')}>
                    <span className="truncate">{word.translate || t('noDefinition')}</span>
                    {word.lastClipAddedAt && (
                      <span
                        className={[
                          'shrink-0 text-[10px] tabular-nums',
                          active ? 'text-primary-foreground/60' : 'text-muted-foreground/80'
                        ].join(' ')}
                        title={t('sortByRecentVideo')}
                      >
                        {t('videoAddedAt', { time: TimeUtil.dateToRelativeTime(TimeUtil.isoToDate(word.lastClipAddedAt)) })}
                      </span>
                    )}
                  </div>
                </div>
              );
            }}
          />
        )}
      </div>
    </div>
  );
}
