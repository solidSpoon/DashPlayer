import React, { useMemo, useRef } from 'react';
import { Input } from '@/fronted/components/ui/input';
import { Button } from '@/fronted/components/ui/button';
import { Search, Upload, Download, List, LocateFixed } from 'lucide-react';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/fronted/components/ui/tooltip';
import { videoLearningApi } from '@/fronted/features/video-learning/videoLearningApi';
import { useTranslation } from 'react-i18next';

interface WordItem {
  id: number;
  word: string;
  translate: string;
  created_at: string;
  updated_at: string;
  videoCount?: number;
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
}: Props) {
  const virtuosoRef = useRef<VirtuosoHandle>(null);
  const { t } = useTranslation('common');

  const filteredWords = useMemo(() => {
    if (!searchTerm) return words;
    const term = searchTerm.toLowerCase();
    return words.filter((word) =>
      word.word.toLowerCase().includes(term) ||
      word.translate?.toLowerCase().includes(term)
    );
  }, [words, searchTerm]);

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
    const targetIndex = filteredWords.findIndex((word) => word.id === selectedWord.id);
    if (targetIndex >= 0) {
      virtuosoRef.current?.scrollToIndex({ index: targetIndex, align: 'center', behavior: 'smooth' });
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
              {searchTerm && <span className="ml-1.5 text-primary">({t('foundWords', { count: filteredWords.length })})</span>}
            </div>
            <div className="flex items-center gap-1">
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
        ) : filteredWords.length === 0 ? (
          <div className="text-center text-muted-foreground py-10 text-xs">
            {searchTerm ? t('noMatchingWords') : t('noVocabulary')}
          </div>
        ) : (
          <Virtuoso
            ref={virtuosoRef}
            style={{ height: '100%' }}
            className="scrollbar-thin"
            data={filteredWords}
            overscan={200}
            itemContent={(index, word) => {
              const active = selectedWord?.id === word.id;
              return (
                <div
                  role="button"
                  tabIndex={0}
                  className={[
                    'px-3 py-2 rounded-xl cursor-pointer transition-all text-xs mb-1.5 flex flex-col gap-0.5',
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
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold text-sm tracking-tight truncate">{word.word}</div>
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
                  <div className={['text-xs truncate', active ? 'text-primary-foreground/80' : 'text-muted-foreground'].join(' ')}>
                    {word.translate || t('noDefinition')}
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
