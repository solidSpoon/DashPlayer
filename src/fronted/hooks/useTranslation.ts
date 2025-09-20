import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import hash from 'object-hash';
import { Sentence } from '@/common/types/SentenceC';
import { getRendererLogger } from '@/fronted/log/simple-logger';

const api = window.electron;

// 每句话的翻译状态
export type TranslationStatus = 'untranslated' | 'translating' | 'completed';

// 翻译状态
export interface TranslationState {
    // 翻译引擎
    engine: 'tencent' | 'openai';

    // 翻译缓存 - key为translationKey，value为翻译结果
    translations: Map<string, string>;

    // 翻译状态 - key为translationKey，value为状态
    translationStatus: Map<string, TranslationStatus>;
}

// 生成翻译key的工具函数 - hash(附近三行)
export function generateTranslationKey(sentences: Sentence[], centerIndex: number): string {
    const startIndex = Math.max(0, centerIndex - 1);
    const endIndex = Math.min(sentences.length - 1, centerIndex + 1);

    const contextTexts = [];
    for (let i = startIndex; i <= endIndex; i++) {
        contextTexts.push(sentences[i]?.text || '');
    }

    return hash(contextTexts.join('|'));
}

// 注：现在直接使用 Sentence.transGroup 字段，不需要重新计算分组

// 翻译动作
export interface TranslationActions {

    // 懒加载翻译 - 发送索引数组
    loadTranslationGroup: (sentences: Sentence[], currentIndex: number) => void;

    // 强制重新翻译
    retranslate: (fileHash: string, indices: number[], useCache?: boolean) => void;

    // 更新翻译结果 (由前端Controller调用) - 单个
    updateTranslation: (key: string, translation: string, isComplete?: boolean) => void;

    // 批量更新翻译结果 (由前端Controller调用) - 数组
    updateTranslations: (translations: Array<{ key: string, translation: string, isComplete?: boolean }>) => void;

    // 清除翻译缓存
    clearTranslations: () => void;

    // 设置翻译引擎
    setEngine: (engine: 'tencent' | 'openai') => void;
}

// 创建翻译Store
const useTranslation = create(
    subscribeWithSelector<TranslationState & TranslationActions>((set, get) => ({
        // 初始状态
        engine: 'tencent',
        translations: new Map(),
        translationStatus: new Map(),

        // 懒加载翻译 - 需要传入sentences数据来获取translationKey
        loadTranslationGroup: (sentences: Sentence[], currentIndex: number) => {

            if (!sentences || sentences.length === 0) {
                return;
            }

            const state = get();
            const fileHash = sentences[0]?.fileHash;

            if (!fileHash) {
                return;
            }

            // 计算要翻译的范围 (当前index ± 10)
            const startIndex = Math.max(0, currentIndex - 10);
            const endIndex = Math.min(sentences.length - 1, currentIndex + 10);
            const untranslatedIndices = [];

            for (let i = startIndex; i <= endIndex; i++) {
                const sentence = sentences[i];
                if (!sentence || !sentence.translationKey) continue;

                const translationKey = sentence.translationKey;
                const status = state.translationStatus.get(translationKey) || 'untranslated';
                const hasTranslation = state.translations.has(translationKey);

                // 只加入未翻译或翻译失败的
                if (status === 'untranslated' || (!hasTranslation && status !== 'translating')) {
                    untranslatedIndices.push(i);
                }
            }

            if (untranslatedIndices.length === 0) {
                return;
            }

            // 只发送未翻译的索引
            api.call('ai-trans/request-group-translation', {
                fileHash,
                indices: untranslatedIndices,
                useCache: true
            }).catch(error => {
                getRendererLogger('useTranslation').error('group translation request failed', { error });
            });
        },

        // 强制重新翻译
        retranslate: (fileHash: string, indices: number[], useCache = false) => {
            // 发送索引数组，不使用缓存
            api.call('ai-trans/request-group-translation', {
                fileHash,
                indices,
                useCache
            }).catch(error => {
                getRendererLogger('useTranslation').error('retranslate request failed', { error });
            });
        },

        // 更新单个翻译结果 (由前端Controller调用)
        updateTranslation: (key: string, translation: string, isComplete = true) => {

            set(state => {
                const newTranslations = new Map(state.translations);
                const newStatus = new Map(state.translationStatus);

                newTranslations.set(key, translation);
                newStatus.set(key, isComplete ? 'completed' : 'translating');

                return {
                    ...state,
                    translations: newTranslations,
                    translationStatus: newStatus
                };
            });
        },

        // 批量更新翻译结果 (由前端Controller调用)
        updateTranslations: (translations: Array<{ key: string, translation: string, isComplete?: boolean }>) => {

            set(state => {
                const newTranslations = new Map(state.translations);
                const newStatus = new Map(state.translationStatus);

                translations.forEach(({ key, translation, isComplete = true }) => {
                    newTranslations.set(key, translation);
                    newStatus.set(key, isComplete ? 'completed' : 'translating');
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
                translations: new Map(),
                translationStatus: new Map()
            });
        },

        // 设置翻译引擎
        setEngine: (engine: 'tencent' | 'openai') => {
            set({ engine });
        }
    }))
);

export default useTranslation;
