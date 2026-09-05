/**
 * 管理播放器生词表、词形映射和基于词形的命中判断。
 *
 * 词表以 Set 存储：字幕每个词渲染都会查询命中，数组扫描在词表较大时是热路径瓶颈。
 */
import { create } from 'zustand';
import { useStoreWithEqualityFn } from 'zustand/traditional';

type VocabularyFormsMap = Record<string, string>;

interface VocabularyState {
    /** 生词基础形态集合。 */
    vocabularyWords: Set<string>;
    /** 不同形态 -> 基础形态的映射。 */
    vocabularyForms: VocabularyFormsMap;
    version: number;
    setVocabularyWords: (words: string[]) => void;
    setVocabularyForms: (forms: VocabularyFormsMap) => void;
    addVocabularyWords: (words: string[]) => void;
    removeVocabularyWords: (words: string[]) => void;
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

const useVocabularyStore = create<VocabularyState>((set, get) => ({
    vocabularyWords: new Set<string>(),
    vocabularyForms: {},
    version: 0,

    setVocabularyWords: (words: string[]) => {
        const normalized = new Set<string>();
        for (const word of words) {
            const cleaned = normalizeWord(word);
            if (cleaned) {
                normalized.add(cleaned);
            }
        }
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
            const combined = new Set(state.vocabularyWords);
            for (const word of normalized) {
                combined.add(word);
            }
            return {
                vocabularyWords: combined,
                version: state.version + 1
            };
        });
    },

    /**
     * 从生词表中移除单词；同步清理指向被删基础形态的变体映射。
     *
     * 词表变化会递增 version，驱动依赖词表的组件（如裁切状态重检）。
     */
    removeVocabularyWords: (words: string[]) => {
        const normalized = words
            .map(normalizeWord)
            .filter((word): word is string => !!word);
        if (normalized.length === 0) {
            return;
        }

        set((state) => {
            const remaining = new Set(state.vocabularyWords);
            let removed = false;
            for (const word of normalized) {
                if (remaining.delete(word)) {
                    removed = true;
                }
            }
            // 被删基础形态的变体映射也要清理，否则变体仍会被判为生词。
            const removedSet = new Set(normalized);
            const forms = Object.fromEntries(
                Object.entries(state.vocabularyForms).filter(([, base]) => !removedSet.has(base))
            );
            if (!removed && Object.keys(forms).length === Object.keys(state.vocabularyForms).length) {
                return state;
            }
            return {
                vocabularyWords: remaining,
                vocabularyForms: forms,
                version: state.version + 1
            };
        });
    },

    clearVocabularyWords: () => {
        set((state) => ({
            vocabularyWords: new Set<string>(),
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
        return vocabularyWords.has(normalized);
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
        return vocabularyWords.has(normalized) ? normalized : undefined;
    }
	}));

const vocabularyStore = useVocabularyStore;

export function useVocabularyState<T>(
    selector: (s: VocabularyState) => T,
    equalityFn?: (a: T, b: T) => boolean
): T {
    return useStoreWithEqualityFn(vocabularyStore, selector, equalityFn);
}

export default useVocabularyStore;
