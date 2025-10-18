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

type Props = {
  words: WordItem[];
  loading: boolean;
  selectedWord: WordItem | null;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  onWordClick: (word: WordItem) => void;
  onClearSelection: () => void;
  onExportTemplate: () => void;
  onImportWords: (file: File) => void;
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
  const fileRef = useRef<HTMLInputElement>(null);
  const virtuosoRef = useRef<VirtuosoHandle>(null);

  const filteredWords = useMemo(() => {
    if (!searchTerm) return words;
    const term = searchTerm.toLowerCase();
    return words.filter((word) =>
      word.word.toLowerCase().includes(term) ||
      word.translate?.toLowerCase().includes(term) ||
      word.stem?.toLowerCase().includes(term)
    );
  }, [words, searchTerm]);

  const handleImportClick = () => {
    fileRef.current?.click();
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onImportWords(file);
      e.target.value = '';
    }
  };

  
  return (
    <div className="h-full flex flex-col border-r">
      {/* 顶部工具栏 */}
      <div className="p-4 border-b space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            className="pl-10"
            placeholder="搜索单词..."
            value={searchTerm}
            onChange={(e) => onSearchChange(e.target.value)}
          />
        </div>
        <TooltipProvider>
          <div className="flex items-center justify-end gap-2 text-xs text-gray-500">
            <div className="mr-auto">
              共 {words.length} 个单词
              {searchTerm && <span className="ml-2 text-blue-600">搜索到 {filteredWords.length} 个</span>}
            </div>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="outline"
                  size="icon"
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
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      {/* 列表区域：使用虚拟列表，占满剩余高度 */}
      <div className="flex-1 min-h-0 p-3 pt-2">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <div className="flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
              加载中...
            </div>
          </div>
        ) : filteredWords.length === 0 ? (
          <div className="text-center text-gray-500 py-8">
            {searchTerm ? '未找到匹配的单词' : '暂无生词记录'}
          </div>
        ) : (
          <Virtuoso
            ref={virtuosoRef}
            style={{ height: '100%' }}
            className="scrollbar-thin scrollbar-track-gray-200 dark:scrollbar-track-gray-800 scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-600"
            data={filteredWords}
            overscan={200}
            itemContent={(index, word) => {
              const active = selectedWord?.id === word.id;
              return (
                <div
                  role="button"
                  tabIndex={0}
                  className={[
                    'p-2 rounded cursor-pointer transition-all text-sm leading-tight mb-1',
                    active ? 'bg-blue-500 text-white shadow-sm' : 'hover:bg-gray-100 dark:hover:bg-gray-700',
                  ].join(' ')}
                  onClick={() => onWordClick(word)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      onWordClick(word);
                    }
                  }}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-medium">{word.word}</div>
                    {!!word.videoCount && word.videoCount > 0 && (
                      <div
                        className={[
                          'text-xs px-2 py-0.5 rounded-full',
                          active
                            ? 'bg-blue-400 text-white'
                            : 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300',
                        ].join(' ')}
                      >
                        {word.videoCount}个视频
                      </div>
                    )}
                  </div>
                  <div className={['text-xs truncate', active ? 'text-blue-100' : 'text-gray-500'].join(' ')}>
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
