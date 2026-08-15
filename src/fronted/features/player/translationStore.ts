/**
 * 管理字幕翻译缓存、翻译状态以及按需触发的分组翻译请求。
 */
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import hash from 'object-hash';
import { Sentence } from '@/common/types/SentenceC';
import { getRendererLogger } from '@/fronted/log/simple-logger';
import { RendererTranslationFailure, RendererTranslationItem, TranslationMode } from '@/common/types/TranslationResult';
import { playerApi } from '@/fronted/features/player/playerApi';

// 每句话的翻译状态
export type TranslationStatus = 'untranslated' | 'translating' | 'completed';

/**
 * 字幕翻译状态仓库。
 */
export interface TranslationState {
    /** 当前启用的翻译引擎。 */
    engine: 'tencent' | 'openai' | 'none';
    /** OpenAI 字幕模式。 */
    openAiMode: TranslationMode;
    /** 当前激活字幕文件哈希。 */
    activeFileHash: string | null;

    /** 当前展示中的翻译文本；流式中间态也会写入这里。 */
    translations: Map<string, string>;
    /** 已完成并可作为失败回滚基线的翻译文本。 */
    committedTranslations: Map<string, string>;
    /** 当前翻译状态。 */
    translationStatus: Map<string, TranslationStatus>;
    /** 已请求翻译的最远句子游标（-1 表示尚未发起任何翻译请求）。 */
    translationCursor: number;
    /** 已发起翻译请求、尚未返回的字幕文件集合，用于请求去重。 */
    inflightRequests: Set<string>;
}

// 注：现在直接使用 Sentence.transGroup 字段，不需要重新计算分组

// 翻译动作
export interface TranslationActions {

    // 懒加载翻译 - 发送索引数组
    loadTranslationGroup: (sentences: Sentence[], currentIndex: number) => void;

    // 强制重新翻译
    retranslate: (fileHash: string, indices: number[], useCache?: boolean) => void;

    // 更新翻译结果 (由前端Controller调用) - 单个
    updateTranslation: (item: RendererTranslationItem) => void;

    // 批量更新翻译结果 (由前端Controller调用) - 数组
    updateTranslations: (translations: RendererTranslationItem[]) => void;

    // 批量恢复翻译失败状态
    markTranslationFailed: (failure: RendererTranslationFailure) => void;

    // 清除翻译缓存
    clearTranslations: () => void;

    // 设置翻译引擎
    setEngine: (engine: 'tencent' | 'openai' | 'none') => void;

    // 更新 OpenAI 字幕模式
    setOpenAiMode: (mode: TranslationMode) => void;

    // 设置当前激活的字幕文件哈希
    setActiveFileHash: (fileHash: string | null) => void;
}

// 创建翻译Store
const useTranslation = create(
    subscribeWithSelector<TranslationState & TranslationActions>((set, get) => ({
        // 初始状态
        engine: 'none',
        openAiMode: 'zh',
        activeFileHash: null,
        translations: new Map(),
        committedTranslations: new Map(),
        translationStatus: new Map(),
        translationCursor: -1,
        inflightRequests: new Set(),

        /**
         * 按当前句附近的窗口懒加载字幕翻译。
         *
         * 行为说明：
         * - 仅当句子所属文件与当前激活字幕上下文一致时才会发请求，避免视频/字幕切换期间把旧副作用打到新上下文。
         * - 请求发出前先把目标句状态置为 translating；若请求失败，再恢复为 untranslated。
         * - 同一文件存在进行中的请求时不再重复发起（in-flight 去重）。
         * - translationCursor 是「已请求覆盖的前沿水线」：正常播放只扫描水线之后的窗口，
         *   避免逐句重复请求；当回退 seek 落到水线之后且该区域有未翻译句时，回退水线重新覆盖。
         *
         * @param sentences 当前字幕列表。
         * @param currentIndex 当前聚焦句索引。
         */
        loadTranslationGroup: (sentences: Sentence[], currentIndex: number) => {

            if (!sentences || sentences.length === 0) {
                return;
            }

            const fileHash = sentences[0]?.fileHash;

            if (!fileHash) {
                return;
            }

            const state = get();
            if (state.activeFileHash !== fileHash) {
                return;
            }
            if (get().inflightRequests.has(fileHash)) {
                return;
            }

            const windowStart = Math.max(0, currentIndex - 10);
            const windowEnd = Math.min(sentences.length - 1, currentIndex + 10);

            // 回退 seek：水线内窗口仍有未翻译句时，把水线回退到窗口起点之前，重新覆盖该区域。
            // 用 while 反复检查，直到窗口内（水线之下）不再有未翻译句。
            let hasBackwardUntranslated = true;
            while (hasBackwardUntranslated) {
                const cursor = get().translationCursor;
                if (cursor < windowStart) {
                    hasBackwardUntranslated = false;
                    break;
                }
                const coverEnd = Math.min(windowEnd, cursor);
                hasBackwardUntranslated = sentences
                    .slice(windowStart, coverEnd + 1)
                    .some(sentence => {
                        if (!sentence || !sentence.translationKey) {
                            return false;
                        }
                        const status = get().translationStatus.get(sentence.translationKey) || 'untranslated';
                        return status === 'untranslated';
                    });
                if (hasBackwardUntranslated) {
                    set(currentState => ({
                        ...currentState,
                        translationCursor: windowStart - 1,
                    }));
                }
            }

            // 以当前句为中心扫描 ±10 窗口；只扫描水线之后未翻译的句子，单批最多 20 句。
            const cursor = get().translationCursor;
            const scanStart = Math.max(windowStart, cursor + 1);
            const scanEnd = Math.min(windowEnd, scanStart + 19);
            const untranslatedIndices: number[] = [];
            const requestedKeys: string[] = [];

            for (let i = scanStart; i <= scanEnd; i++) {
                const sentence = sentences[i];
                if (!sentence || !sentence.translationKey) continue;

                const translationKey = sentence.translationKey;
                const status = get().translationStatus.get(translationKey) || 'untranslated';
                const hasTranslation = get().translations.has(translationKey);

                // 只加入未翻译或翻译失败的
                if (status === 'untranslated' || (!hasTranslation && status !== 'translating')) {
                    untranslatedIndices.push(i);
                    requestedKeys.push(translationKey);
                }
            }

            if (untranslatedIndices.length === 0) {
                // 窗口内没有待翻译句，游标前进到窗口末尾，避免下次重复扫描。
                set(currentState => ({
                    ...currentState,
                    translationCursor: Math.max(currentState.translationCursor, windowEnd),
                }));
                return;
            }

            const batchStart = scanStart;
            const batchEnd = Math.max(...untranslatedIndices);
            set(currentState => {
                const newStatus = new Map(currentState.translationStatus);
                requestedKeys.forEach((key) => {
                    newStatus.set(key, 'translating');
                });
                return {
                    ...currentState,
                    translationStatus: newStatus,
                    translationCursor: batchEnd,
                    inflightRequests: new Set([...currentState.inflightRequests, fileHash]),
                };
            });

            // 只发送未翻译的索引
            playerApi.requestGroupTranslation(fileHash, untranslatedIndices, true).catch(error => {
                set(currentState => {
                    const newStatus = new Map(currentState.translationStatus);
                    requestedKeys.forEach((key) => {
                        if (newStatus.get(key) === 'translating') {
                            newStatus.set(key, 'untranslated');
                        }
                    });
                    // 回退游标并释放 in-flight，允许后续批次重试失败窗口。
                    const nextInflight = new Set(currentState.inflightRequests);
                    nextInflight.delete(fileHash);
                    return {
                        ...currentState,
                        translationStatus: newStatus,
                        translationCursor: Math.min(batchStart - 1, currentState.translationCursor),
                        inflightRequests: nextInflight,
                    };
                });
                getRendererLogger('useTranslation').error('group translation request failed', { error });
                const message = error instanceof Error ? error.message : String(error);
                const dedupeKey = `subtitle-translation-request:${state.engine}:${hash(message)}`;
                const event = new CustomEvent('show-toast', {
                    detail: {
                        title: '字幕翻译失败',
                        message,
                        variant: 'error',
                        position: 'top-left',
                        bubble: true,
                        dedupeKey,
                    }
                });
                window.dispatchEvent(event);
            });
        },

        // 强制重新翻译
        retranslate: (fileHash: string, indices: number[], useCache = false) => {
            set(state => {
                const newStatus = new Map(state.translationStatus);
                indices.forEach((index) => {
                    const key = `${fileHash}:${index}`;
                    newStatus.set(key, 'translating');
                });
                return {
                    ...state,
                    translationStatus: newStatus
                };
            });
            // 发送索引数组，不使用缓存
            playerApi.requestGroupTranslation(fileHash, indices, useCache).catch(error => {
                set(state => {
                    const newStatus = new Map(state.translationStatus);
                    indices.forEach((index) => {
                        const key = `${fileHash}:${index}`;
                        if (newStatus.get(key) === 'translating') {
                            newStatus.set(key, 'untranslated');
                        }
                    });
                    return {
                        ...state,
                        translationStatus: newStatus
                    };
                });
                getRendererLogger('useTranslation').error('retranslate request failed', { error });
                const message = error instanceof Error ? error.message : String(error);
                const dedupeKey = `subtitle-translation-request:${get().engine}:${hash(message)}`;
                const event = new CustomEvent('show-toast', {
                    detail: {
                        title: '字幕翻译失败',
                        message,
                        variant: 'error',
                        position: 'top-left',
                        bubble: true,
                        dedupeKey,
                    }
                });
                window.dispatchEvent(event);
            });
        },

        // 更新单个翻译结果 (由前端Controller调用)
        updateTranslation: (item: RendererTranslationItem) => {

            set(state => {
                if (!shouldAcceptTranslation(state, item)) {
                    return state;
                }
                const { key, translation, isComplete = true } = item;
                const newTranslations = new Map(state.translations);
                const newCommittedTranslations = new Map(state.committedTranslations);
                const newStatus = new Map(state.translationStatus);

                newTranslations.set(key, translation);
                newStatus.set(key, isComplete ? 'completed' : 'translating');
                if (isComplete) {
                    newCommittedTranslations.set(key, translation);
                }

                return {
                    ...state,
                    translations: newTranslations,
                    committedTranslations: newCommittedTranslations,
                    translationStatus: newStatus
                };
            });
        },

        // 批量更新翻译结果 (由前端Controller调用)
        updateTranslations: (items: RendererTranslationItem[]) => {

            set(state => {
                const filtered = items.filter(item => shouldAcceptTranslation(state, item));
                if (filtered.length === 0) {
                    return state;
                }

                const newTranslations = new Map(state.translations);
                const newCommittedTranslations = new Map(state.committedTranslations);
                const newStatus = new Map(state.translationStatus);
                const nextInflight = new Set(state.inflightRequests);

                filtered.forEach(({ key, translation, isComplete = true }) => {
                    newTranslations.set(key, translation);
                    newStatus.set(key, isComplete ? 'completed' : 'translating');
                    if (isComplete) {
                        newCommittedTranslations.set(key, translation);
                    }
                });
                // 单个请求批次可能包含多个翻译窗口，逐个窗口回传终态。
                // 只有该文件不再存在 translating 状态（整批真正结束）时才释放 in-flight。
                filtered.forEach(item => {
                    if (!nextInflight.has(item.fileHash)) {
                        return;
                    }
                    const prefix = `${item.fileHash}:`;
                    const stillTranslating = Array.from(newStatus.entries())
                        .some(([key, status]) => key.startsWith(prefix) && status === 'translating');
                    if (!stillTranslating) {
                        nextInflight.delete(item.fileHash);
                    }
                });

                return {
                    ...state,
                    translations: newTranslations,
                    committedTranslations: newCommittedTranslations,
                    translationStatus: newStatus,
                    inflightRequests: nextInflight,
                };
            });
        },

        // 批量恢复翻译失败状态
        markTranslationFailed: (failure: RendererTranslationFailure) => {
            set(state => {
                if (!shouldAcceptTranslationFailure(state, failure)) {
                    return state;
                }

                const newTranslations = new Map(state.translations);
                const newStatus = new Map(state.translationStatus);
                const nextInflight = new Set(state.inflightRequests);
                let minFailedIndex = Infinity;
                failure.keys.forEach((key) => {
                    if (newStatus.get(key) === 'translating') {
                        const committed = state.committedTranslations.get(key);
                        if (committed !== undefined) {
                            newTranslations.set(key, committed);
                        } else {
                            newTranslations.delete(key);
                        }
                        newStatus.set(key, 'untranslated');
                        const index = Number(key.split(':').pop());
                        if (Number.isFinite(index)) {
                            minFailedIndex = Math.min(minFailedIndex, index);
                        }
                    }
                });
                if (Number.isFinite(minFailedIndex)) {
                    nextInflight.delete(failure.fileHash);
                }

                return {
                    ...state,
                    translations: newTranslations,
                    translationStatus: newStatus,
                    translationCursor: Number.isFinite(minFailedIndex)
                        ? Math.min(state.translationCursor, minFailedIndex - 1)
                        : state.translationCursor,
                    inflightRequests: nextInflight,
                };
            });
        },

        // 清除翻译缓存
        clearTranslations: () => {
            set({
                activeFileHash: null,
                translations: new Map(),
                committedTranslations: new Map(),
                translationStatus: new Map(),
                translationCursor: -1,
                inflightRequests: new Set(),
            });
        },

        // 设置翻译引擎
        setEngine: (engine: 'tencent' | 'openai' | 'none') => {
            set(state => {
                if (state.engine === engine) {
                    return state;
                }
                return {
                    engine,
                    openAiMode: state.openAiMode,
                    activeFileHash: state.activeFileHash,
                    translations: new Map(),
                    committedTranslations: new Map(),
                    translationStatus: new Map(),
                    translationCursor: -1,
                    inflightRequests: new Set(),
                };
            });
        },

        setOpenAiMode: (mode: TranslationMode) => {
            set(state => {
                if (state.openAiMode === mode) {
                    return state;
                }

                const shouldReset = state.engine === 'openai';
                return {
                    engine: state.engine,
                    openAiMode: mode,
                    activeFileHash: state.activeFileHash,
                    translations: shouldReset ? new Map() : state.translations,
                    committedTranslations: shouldReset ? new Map() : state.committedTranslations,
                    translationStatus: shouldReset ? new Map() : state.translationStatus,
                    translationCursor: shouldReset ? -1 : state.translationCursor,
                    inflightRequests: shouldReset ? new Set() : state.inflightRequests,
                };
            });
        },

        setActiveFileHash: (fileHash: string | null) => {
            set(state => {
                if (state.activeFileHash === fileHash) {
                    return state;
                }
                return {
                    ...state,
                    activeFileHash: fileHash,
                    translations: new Map(),
                    committedTranslations: new Map(),
                    translationStatus: new Map(),
                    translationCursor: -1,
                    inflightRequests: new Set(),
                };
            });
        },
    }))
);

const shouldAcceptTranslation = (
    state: TranslationState,
    item: RendererTranslationItem
): boolean => {
    if (item.provider !== state.engine) {
        return false;
    }

    if (state.activeFileHash !== item.fileHash) {
        return false;
    }

    if (item.provider === 'openai') {
        const mode = item.mode ?? 'zh';
        return mode === state.openAiMode;
    }

    return true;
};

/**
 * 判断当前翻译失败事件是否属于前端当前激活的字幕上下文。
 *
 * @param state 当前翻译状态。
 * @param failure 后端回传的失败事件。
 * @returns 只有当前文件、当前引擎/模式匹配时才接收。
 */
const shouldAcceptTranslationFailure = (
    state: TranslationState,
    failure: RendererTranslationFailure
): boolean => {
    if (failure.fileHash !== state.activeFileHash) {
        return false;
    }

    if (state.engine === 'none') {
        return true;
    }

    if (failure.provider === 'openai') {
        const mode = failure.mode ?? 'zh';
        return state.engine === 'openai' && mode === state.openAiMode;
    }

    return state.engine === failure.provider;
};

export default useTranslation;
