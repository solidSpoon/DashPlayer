/**
 * 管理字幕翻译缓存、翻译状态以及按需触发的分组翻译请求。
 */
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import hash from 'object-hash';
import { Sentence } from '@/common/types/SentenceC';
import { getRendererLogger } from '@/fronted/log/simple-logger';
import { RendererTranslationFailure, RendererTranslationItem, TranslationMode } from '@/common/types/TranslationResult';
import { backendClient } from '@/fronted/application/bootstrap/backendClient';

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

        /**
         * 按当前句附近的窗口懒加载字幕翻译。
         *
         * 行为说明：
         * - 仅当句子所属文件与当前激活字幕上下文一致时才会发请求，避免视频/字幕切换期间把旧副作用打到新上下文。
         * - 请求发出前先把目标句状态置为 translating；若请求失败，再恢复为 untranslated。
         *
         * @param sentences 当前字幕列表。
         * @param currentIndex 当前聚焦句索引。
         */
        loadTranslationGroup: (sentences: Sentence[], currentIndex: number) => {

            if (!sentences || sentences.length === 0) {
                return;
            }

            const state = get();
            if (state.engine === 'none') {
                return;
            }

            const fileHash = sentences[0]?.fileHash;

            if (!fileHash) {
                return;
            }

            if (state.activeFileHash !== fileHash) {
                return;
            }

            // 计算要翻译的范围 (当前index ± 10)
            const startIndex = Math.max(0, currentIndex - 10);
            const endIndex = Math.min(sentences.length - 1, currentIndex + 10);
            const untranslatedIndices: number[] = [];
            const requestedKeys: string[] = [];

            for (let i = startIndex; i <= endIndex; i++) {
                const sentence = sentences[i];
                if (!sentence || !sentence.translationKey) continue;

                const translationKey = sentence.translationKey;
                const status = state.translationStatus.get(translationKey) || 'untranslated';
                const hasTranslation = state.translations.has(translationKey);

                // 只加入未翻译或翻译失败的
                if (status === 'untranslated' || (!hasTranslation && status !== 'translating')) {
                    untranslatedIndices.push(i);
                    requestedKeys.push(translationKey);
                }
            }

            if (untranslatedIndices.length === 0) {
                return;
            }

            set(currentState => {
                const newStatus = new Map(currentState.translationStatus);
                requestedKeys.forEach((key) => {
                    newStatus.set(key, 'translating');
                });
                return {
                    ...currentState,
                    translationStatus: newStatus
                };
            });

            // 只发送未翻译的索引
            backendClient.call('ai-trans/request-group-translation', {
                fileHash,
                indices: untranslatedIndices,
                useCache: true
            }).catch(error => {
                set(currentState => {
                    const newStatus = new Map(currentState.translationStatus);
                    requestedKeys.forEach((key) => {
                        if (newStatus.get(key) === 'translating') {
                            newStatus.set(key, 'untranslated');
                        }
                    });
                    return {
                        ...currentState,
                        translationStatus: newStatus
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

        /**
         * 强制重新翻译指定字幕句。
         *
         * @param fileHash 当前字幕文件哈希。
         * @param indices 需要重新翻译的字幕索引列表。
         * @param useCache 是否允许使用已有缓存，默认强制请求新结果。
         */
        retranslate: (fileHash: string, indices: number[], useCache = false) => {
            if (get().engine === 'none') {
                return;
            }

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
            backendClient.call('ai-trans/request-group-translation', {
                fileHash,
                indices,
                useCache
            }).catch(error => {
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

                filtered.forEach(({ key, translation, isComplete = true }) => {
                    newTranslations.set(key, translation);
                    newStatus.set(key, isComplete ? 'completed' : 'translating');
                    if (isComplete) {
                        newCommittedTranslations.set(key, translation);
                    }
                });

                return {
                    ...state,
                    translations: newTranslations,
                    committedTranslations: newCommittedTranslations,
                    translationStatus: newStatus
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
                failure.keys.forEach((key) => {
                    if (newStatus.get(key) === 'translating') {
                        const committed = state.committedTranslations.get(key);
                        if (committed !== undefined) {
                            newTranslations.set(key, committed);
                        } else {
                            newTranslations.delete(key);
                        }
                        newStatus.set(key, 'untranslated');
                    }
                });

                return {
                    ...state,
                    translations: newTranslations,
                    translationStatus: newStatus
                };
            });
        },

        // 清除翻译缓存
        clearTranslations: () => {
            set({
                activeFileHash: null,
                translations: new Map(),
                committedTranslations: new Map(),
                translationStatus: new Map()
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
                    translationStatus: new Map()
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
                    translationStatus: shouldReset ? new Map() : state.translationStatus
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
                    translationStatus: new Map()
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
