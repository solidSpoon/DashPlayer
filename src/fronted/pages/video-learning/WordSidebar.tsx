import React, { useMemo, useRef } from 'react';
import { Input } from '@/fronted/components/ui/input';
import { Button } from '@/fronted/components/ui/button';
import { Search, Upload, Download, List, LocateFixed, Trash2, RotateCw } from 'lucide-react';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger
} from '@/fronted/components/ui/tooltip';
import { backendClient } from '@/fronted/application/bootstrap/backendClient';
import { toast } from '@/fronted/components/ui/use-toast';

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
  onDeleteWord: (word: WordItem) => void;
  onRefreshWord: (word: WordItem) => void;
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
  onDeleteWord,
  onRefreshWord,
}: Props) {
  const virtuosoRef = useRef<VirtuosoHandle>(null);

  const filteredWords = useMemo(() => {
    if (!searchTerm) return words;
    const term = searchTerm.toLowerCase();
    return words.filter((word) =>
      word.word.toLowerCase().includes(term) ||
      word.translate?.toLowerCase().includes(term)
    );
  }, [words, searchTerm]);

  const handleImportClick = async () => {
    const selectedFiles = await backendClient.call('system/select-file', ['.xlsx', '.xls']);
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

  const handleDelete = (e: React.MouseEvent, word: WordItem) => {
    e.stopPropagation();
    onDeleteWord(word);
  };

  const handleRefresh = (e: React.MouseEvent, word: WordItem) => {
    e.stopPropagation();
    onRefreshWord(word);
  };

  return (
    <div className="h-full flex flex-col">
      {/* 顶部工具栏 */}
      <div className="pb-3 space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
          <Input
            className="pl-10"
            placeholder="搜索单词..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        <TooltipProvider>
          <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
            <div className="mr-auto">
              共 {words.length} 个单词
              {searchTerm && <span className="ml-2 text-primary">搜索到 {filteredWords.length} 个</span>}
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="w-8 h-8"
                  aria-label="导出模板"
                  type="button"
                  onClick={onExportTemplate}
                >
                  <Download className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>导出模板</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="w-8 h-8"
                  aria-label="导入 Excel"
                  type="button"
                  onClick={handleImportClick}
                >
                  <Upload className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>导入 Excel</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant={selectedWord ? 'outline' : 'default'}
                  size="icon"
                  className="w-8 h-8"
                  aria-label="显示全部视频"
                  type="button"
                  onClick={handleShowAll}
                >
                  <List className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>显示全部视频</TooltipContent>
            </Tooltip>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
                  className="w-8 h-8"
                  aria-label="定位到当前单词"
                  type="button"
                  onClick={handleLocateCurrent}
                  disabled={!selectedWord}
                >
                  <LocateFixed className="w-4 h-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>定位到当前单词</TooltipContent>
            </Tooltip>
          </div>
        </TooltipProvider>
      </div>

      {/* 列表区域：使用虚拟列表，占满剩余高度 */}
      <div className="flex-1 min-h-0 pt-2">
        {loading ? (
          <div className="flex items-center justify-center h-32 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
              加载中...
            </div>
          </div>
        ) : filteredWords.length === 0 ? (
          <div className="text-center text-muted-foreground py-8 text-sm">
            {searchTerm ? '未找到匹配的单词' : '暂无生词记录'}
          </div>
        ) : (
          <Virtuoso
            ref={virtuosoRef}
            style={{ height: '100%' }}
            className="scrollbar-thin scrollbar-track-gray-100 dark:scrollbar-track-gray-800 scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-600"
            data={filteredWords}
            overscan={200}
            itemContent={(index, word) => {
              const active = selectedWord?.id === word.id;
              return (
                <div
                  role="button"
                  tabIndex={0}
                  className={[
                    'group p-2 rounded-lg cursor-pointer transition-all text-sm leading-tight mb-1 relative',
                    active
                      ? 'bg-primary text-primary-foreground'
                      : 'hover:bg-muted'
                  ].join(' ')}
                  onClick={() => onWordClick(word)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      onWordClick(word);
                    }
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-medium truncate mr-2" title={word.word}>{word.word}</div>
                    <div className="flex items-center gap-1 shrink-0">
                        {!!word.videoCount && word.videoCount > 0 && (
                          <div
                            className={[
                              'text-[10px] px-1.5 py-0.5 rounded-full border',
                              active
                                ? 'bg-primary/20 text-primary-foreground border-primary/30'
                                : 'bg-secondary text-secondary-foreground border-transparent'
                            ].join(' ')}
                          >
                            {word.videoCount}个视频
                          </div>
                        )}
                        <div className={[
                            'flex items-center gap-0.5 transition-opacity',
                            active ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'
                        ].join(' ')}>
                            <Button
                                variant="ghost"
                                size="icon"
                                className={['w-6 h-6 p-0 hover:bg-black/10', active ? 'text-primary-foreground' : 'text-muted-foreground'].join(' ')}
                                title="更新译文"
                                onClick={(e) => handleRefresh(e, word)}
                            >
                                <RotateCw className="w-3 h-3" />
                            </Button>
                            <Button
                                variant="ghost"
                                size="icon"
                                className={['w-6 h-6 p-0 hover:bg-black/10 hover:text-destructive', active ? 'text-primary-foreground' : 'text-muted-foreground'].join(' ')}
                                title="删除"
                                onClick={(e) => handleDelete(e, word)}
                            >
                                <Trash2 className="w-3 h-3" />
                            </Button>
                        </div>
                    </div>
                  </div>
                  <div className={[
                      'text-xs mt-0.5',
                      active ? 'text-primary-foreground/80' : 'text-muted-foreground',
                      'line-clamp-2'
                  ].join(' ')} title={word.translate}>
                    {word.translate || '暂无释义'}
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
