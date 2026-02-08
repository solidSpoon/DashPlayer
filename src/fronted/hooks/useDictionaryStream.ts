import { create } from 'zustand';
import { OpenAIDictionaryResult, OpenAIDictionaryDefinition, OpenAIDictionaryExample } from '@/common/types/YdRes';

interface DictionaryEntry {
    requestId: string;
    word: string;
    data: OpenAIDictionaryResult;
    isComplete: boolean;
    updatedAt: number;
}

interface DictionaryState {
    entries: Map<string, DictionaryEntry>;
    wordActiveRequest: Map<string, string>;
    startRequest: (word: string, requestId: string) => void;
    receiveUpdate: (requestId: string, word: string, data: OpenAIDictionaryResult, isComplete?: boolean) => void;
    setFinalResult: (word: string, requestId: string, data: OpenAIDictionaryResult | null) => void;
    clearByWord: (word: string) => void;
    getActiveEntry: (word: string) => DictionaryEntry | undefined;
}

/**
 * 复制例句数组，确保 store 内部持有独立对象引用。
 */
const cloneExamples = (examples: OpenAIDictionaryExample[]): OpenAIDictionaryExample[] => {
    return examples.map(example => ({
        sentence: example.sentence,
        translation: example.translation
    }));
};

/**
 * 复制释义数组，避免 UI 渲染时出现引用共享副作用。
 */
const cloneDefinitions = (definitions: OpenAIDictionaryDefinition[]): OpenAIDictionaryDefinition[] => {
    return definitions.map(definition => ({
        partOfSpeech: definition.partOfSpeech,
        meaning: definition.meaning,
        examples: cloneExamples(definition.examples)
    }));
};

/**
 * 复制单词卡数据，保证外部更新不会直接污染状态树。
 */
const cloneEntryData = (data: OpenAIDictionaryResult): OpenAIDictionaryResult => ({
    word: data.word,
    phonetic: data.phonetic,
    definitions: cloneDefinitions(data.definitions)
});

/**
 * 生成流式请求的初始空数据，所有字段均为必填默认值。
 */
const createEmptyEntry = (word: string, requestId: string): DictionaryEntry => ({
    requestId,
    word,
    data: {
        word,
        phonetic: '',
        definitions: []
    },
    isComplete: false,
    updatedAt: Date.now()
});

const useDictionaryStream = create<DictionaryState>((set, get) => ({
    entries: new Map<string, DictionaryEntry>(),
    wordActiveRequest: new Map<string, string>(),

    startRequest: (word: string, requestId: string) => {
        set(state => {
            const entries = new Map(state.entries);
            const wordActiveRequest = new Map(state.wordActiveRequest);

            const previousId = wordActiveRequest.get(word);
            if (previousId && previousId !== requestId) {
                entries.delete(previousId);
            }

            const entry = createEmptyEntry(word, requestId);
            entries.set(requestId, entry);
            wordActiveRequest.set(word, requestId);

            return {
                ...state,
                entries,
                wordActiveRequest
            };
        });
    },

    receiveUpdate: (requestId: string, word: string, data: OpenAIDictionaryResult, isComplete = false) => {
        set(state => {
            const entries = new Map(state.entries);
            const wordActiveRequest = new Map(state.wordActiveRequest);

            const existing = entries.get(requestId) ?? createEmptyEntry(word, requestId);

            const updatedEntry: DictionaryEntry = {
                requestId,
                word,
                data: cloneEntryData(data),
                isComplete: isComplete ?? existing.isComplete,
                updatedAt: Date.now()
            };

            entries.set(requestId, updatedEntry);
            wordActiveRequest.set(word, requestId);

            return {
                ...state,
                entries,
                wordActiveRequest
            };
        });
    },

    setFinalResult: (word: string, requestId: string, data: OpenAIDictionaryResult | null) => {
        set(state => {
            const entries = new Map(state.entries);
            const wordActiveRequest = new Map(state.wordActiveRequest);

            if (!data) {
                // 如果没有结果，仍然确保状态为完成
                const existing = entries.get(requestId);
                if (existing) {
                    entries.set(requestId, {
                        ...existing,
                        isComplete: true,
                        updatedAt: Date.now()
                    });
                }

                return {
                    ...state,
                    entries,
                    wordActiveRequest
                };
            }

            const updatedEntry: DictionaryEntry = {
                requestId,
                word,
                data: cloneEntryData(data),
                isComplete: true,
                updatedAt: Date.now()
            };

            entries.set(requestId, updatedEntry);
            wordActiveRequest.set(word, requestId);

            return {
                ...state,
                entries,
                wordActiveRequest
            };
        });
    },

    clearByWord: (word: string) => {
        set(state => {
            const entries = new Map(state.entries);
            const wordActiveRequest = new Map(state.wordActiveRequest);
            const requestId = wordActiveRequest.get(word);

            if (requestId) {
                entries.delete(requestId);
                wordActiveRequest.delete(word);
            }

            return {
                ...state,
                entries,
                wordActiveRequest
            };
        });
    },

    getActiveEntry: (word: string) => {
        const requestId = get().wordActiveRequest.get(word);
        if (!requestId) {
            return undefined;
        }
        return get().entries.get(requestId);
    }
}));

export default useDictionaryStream;

/**
 * 生成字典流式请求 id，便于同词并发请求去重。
 */
export const createDictionaryRequestId = (word: string): string => {
    const normalized = word.trim().toLowerCase().replace(/\s+/g, '-');
    return `dict-${normalized}-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`;
};
