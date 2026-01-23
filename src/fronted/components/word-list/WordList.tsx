import React, { useState } from 'react';
import useSWR from 'swr';
import useFile from '@/fronted/hooks/useFile';
import { ScrollArea } from '@/fronted/components/ui/scroll-area';
import { Loader2 } from 'lucide-react';
import WordListWord from './WordListWord';
import StrUtil from '@/common/utils/str-util';

const api = window.electron;

type WordMap = Record<string, { index: number; text: string }[]>;

const WordList: React.FC = () => {
    const subtitlePath = useFile((s) => s.subtitlePath);
    const [openWord, setOpenWord] = useState<string | null>(null);

    const { data: wordMap, isLoading } = useSWR<WordMap | null>(
        subtitlePath ? ['subtitle/extract-words', subtitlePath] : null,
        ([_key, path]) => api.call('subtitle/extract-words', path)
    );

    const words = wordMap ? Object.keys(wordMap).sort() : [];

    const handleToggle = (word: string) => {
        setOpenWord(prev => prev === word ? null : word);
    };

    return (
        <div className="h-full w-full flex flex-col">
            <div className="p-2 border-b">
                <h4 className="font-semibold text-center">Word List</h4>
            </div>
            <ScrollArea className="h-full w-full">
                <div className="p-4">
                    {isLoading && (
                        <div className="flex items-center justify-center h-full">
                            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                        </div>
                    )}
                    {!isLoading && (words.length === 0) && (
                        <div className="text-center text-sm text-muted-foreground">
                            {StrUtil.isNotBlank(subtitlePath)
                                ? 'No unique words found.'
                                : 'No subtitle file loaded.'}
                        </div>
                    )}
                    {words.length > 0 && (
                        <div className="flex flex-wrap gap-x-4 gap-y-2">
                            {words.map((word) => (
                                <WordListWord
                                    key={word}
                                    word={word}
                                    sentences={wordMap![word]}
                                    isOpen={openWord === word}
                                    onToggle={() => handleToggle(word)}
                                />
                            ))}
                        </div>
                    )}
                </div>
            </ScrollArea>
        </div>
    );
};

export default WordList;

