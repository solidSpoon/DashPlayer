import { create } from 'zustand';
import { useStoreWithEqualityFn } from 'zustand/traditional';

type VocabularyFormsMap = Record<string, string>;

interface VocabularyState {
    vocabularyWords: string[]; // 缓存的词汇单词数组（基础形态）
    vocabularyForms: VocabularyFormsMap; // 记录不同形态 -> 基础形态的映射
    version: number;
    setVocabularyWords: (words: string[]) => void;
    setVocabularyForms: (forms: VocabularyFormsMap) => void;
    addVocabularyWords: (words: string[]) => void;
    clearVocabularyWords: () => void;
    isVocabularyWord: (word: string) => boolean;
    getBaseWord: (word: string) => string | undefined;
}

const normalizeWord = (word: string): string | null => {
    if (!word) {
        return null;
    }
    const normalized = word.toLowerCase().trim();
    return normalized.length > 0 ? normalized : null;
};

const uniqueArray = (words: string[]): string[] => {
    const set = new Set(words);
    return Array.from(set);
};

const useVocabularyStore = create<VocabularyState>((set, get) => ({
    vocabularyWords: [],
    vocabularyForms: {},
    version: 0,

    setVocabularyWords: (words: string[]) => {
        const normalized = uniqueArray(
            words.map(normalizeWord).filter((word): word is string => !!word)
        );
        set((state) => ({
            vocabularyWords: normalized,
            version: state.version + 1
        }));
    },

    setVocabularyForms: (forms: VocabularyFormsMap) => {
        const sanitizedEntries = Object.entries(forms || {}).reduce<VocabularyFormsMap>((acc, [form, base]) => {
            const normalizedForm = normalizeWord(form);
            const normalizedBase = normalizeWord(base);
            if (normalizedForm && normalizedBase) {
                acc[normalizedForm] = normalizedBase;
            }
            return acc;
        }, {});

        set((state) => ({
            vocabularyForms: sanitizedEntries,
            version: state.version + 1
        }));
    },

    addVocabularyWords: (words: string[]) => {
        const normalized = words
            .map(normalizeWord)
            .filter((word): word is string => !!word);
        if (normalized.length === 0) {
            return;
        }

        set((state) => {
            const combined = uniqueArray([...state.vocabularyWords, ...normalized]);
            return {
                vocabularyWords: combined,
                version: state.version + 1
            };
        });
    },

    clearVocabularyWords: () => {
        set((state) => ({
            vocabularyWords: [],
            vocabularyForms: {},
            version: state.version + 1
        }));
    },

    isVocabularyWord: (word: string) => {
        const normalized = normalizeWord(word);
        if (!normalized) {
            return false;
        }
        const { vocabularyWords, vocabularyForms } = get();
        if (vocabularyForms[normalized]) {
            return true;
        }
        return vocabularyWords.includes(normalized);
    },

    getBaseWord: (word: string) => {
        const normalized = normalizeWord(word);
        if (!normalized) {
            return undefined;
        }
        const { vocabularyForms, vocabularyWords } = get();
        if (vocabularyForms[normalized]) {
            return vocabularyForms[normalized];
        }
        return vocabularyWords.includes(normalized) ? normalized : undefined;
    }
}));

export function useVocabularyState<T>(
    selector: (s: VocabularyState) => T,
    equalityFn?: (a: T, b: T) => boolean
): T {
    return useStoreWithEqualityFn(useVocabularyStore, selector, equalityFn);
}

export default useVocabularyStore;
