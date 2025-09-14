import React, { useRef, useState } from 'react';
import { Input } from '@/fronted/components/ui/input';
import { Button } from '@/fronted/components/ui/button';
import { Search, Upload, Download } from 'lucide-react';

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

  const filteredWords = React.useMemo(() => {
    let displayWords = words;
    if (!searchTerm) return displayWords;
    const term = searchTerm.toLowerCase();
    return displayWords.filter((word) =>
      word.word.toLowerCase().includes(term) ||
      word.translate?.toLowerCase().includes(term) ||
      word.stem?.toLowerCase().includes(term)
    );
  }, [words, searchTerm]);

  const handleImportClick = () => {
    fileRef.current?.click();
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

        <div className="flex gap-2">
          <Button variant="outline" size="sm" className="gap-1" onClick={onExportTemplate}>
            <Download className="w-4 h-4" /> 导出模板
          </Button>
          <Button variant="outline" size="sm" className="gap-1" onClick={handleImportClick}>
            <Upload className="w-4 h-4" /> 导入 Excel
          </Button>
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls"
            className="hidden"
            onChange={handleFileChange}
          />
        </div>

        <Button
          variant={selectedWord ? 'default' : 'outline'}
          size="sm"
          className="w-full"
          onClick={onClearSelection}
        >
          显示全部视频
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-3 scrollbar-thin scrollbar-track-gray-200 dark:scrollbar-track-gray-800 scrollbar-thumb-gray-400 dark:scrollbar-thumb-gray-600">
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
          <div className="space-y-1">
            {filteredWords.map((word) => (
              <div
                key={word.id}
                className={`p-2 rounded cursor-pointer transition-all text-sm leading-tight ${
                  selectedWord?.id === word.id
                    ? 'bg-blue-500 text-white shadow-sm'
                    : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                }`}
                onClick={() => onWordClick(word)}
              >
                <div className="flex items-center justify-between">
                  <div className="font-medium">{word.word}</div>
                  {!!word.videoCount && word.videoCount > 0 && (
                    <div
                      className={`text-xs px-2 py-0.5 rounded-full ${
                        selectedWord?.id === word.id
                          ? 'bg-blue-400 text-white'
                          : 'bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300'
                      }`}
                    >
                      {word.videoCount}个视频
                    </div>
                  )}
                </div>
                <div
                  className={`text-xs truncate ${
                    selectedWord?.id === word.id ? 'text-blue-100' : 'text-gray-500'
                  }`}
                >
                  {word.translate || '暂无释义'}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="p-3 border-t text-xs text-gray-500 text-center">
        共 {words.length} 个单词
        {searchTerm && <div className="text-blue-600">搜索到 {filteredWords.length} 个</div>}
        {words.length > 1000 && !searchTerm && <div className="text-orange-600">显示所有单词</div>}
      </div>
    </div>
  );
}