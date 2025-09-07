import { create } from 'zustand';

interface VocabularyState {
    vocabularyWords: string[]; // 缓存的词汇单词数组
    setVocabularyWords: (words: string[]) => void;
    addVocabularyWords: (words: string[]) => void;
    clearVocabularyWords: () => void;
    isVocabularyWord: (word: string) => boolean;
}

const useVocabularyStore = create<VocabularyState>((set, get) => ({
    vocabularyWords: [],
    
    setVocabularyWords: (words: string[]) => {
        console.log('useVocabulary: Setting vocabulary words:', words);
        set({ vocabularyWords: words });
        console.log('useVocabulary: Vocabulary words set, new state:', { vocabularyWords: words });
    },
    
    addVocabularyWords: (words: string[]) => {
        const currentWords = get().vocabularyWords;
        const newWords = [...new Set([...currentWords, ...words])]; // 去重
        console.log('useVocabulary: Adding vocabulary words:', { 
            currentWords, 
            newWords, 
            addedWords: words 
        });
        set({ vocabularyWords: newWords });
    },
    
    clearVocabularyWords: () => {
        console.log('useVocabulary: Clearing vocabulary words');
        set({ vocabularyWords: [] });
    },
    
    isVocabularyWord: (word: string) => {
        const { vocabularyWords } = get();
        const isMatch = vocabularyWords.includes(word);
        console.log('useVocabulary: Checking word:', { 
            word, 
            vocabularyWords, 
            isMatch 
        });
        return isMatch;
    }
}));

export default useVocabularyStore;