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
        set({ vocabularyWords: words });
    },
    
    addVocabularyWords: (words: string[]) => {
        const currentWords = get().vocabularyWords;
        const newWords = [...new Set([...currentWords, ...words])]; // 去重
        set({ vocabularyWords: newWords });
    },
    
    clearVocabularyWords: () => {
        set({ vocabularyWords: [] });
    },
    
    isVocabularyWord: (word: string) => {
        const { vocabularyWords } = get();
        return vocabularyWords.includes(word);
    }
}));

export default useVocabularyStore;