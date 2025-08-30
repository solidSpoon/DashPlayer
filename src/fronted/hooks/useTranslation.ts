import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import hash from 'object-hash';
import { Sentence } from '@/common/types/SentenceC';

const api = window.electron;

// 翻译引擎类型
export type TranslationEngine = 'tencent' | 'openai';

// 翻译状态
export interface TranslationState {
    // 翻译引擎
    engine: TranslationEngine;
    
    // 翻译缓存 - key为translationKey，value为翻译结果
    translations: Map<string, string>;
    
    // 正在请求的翻译key集合，避免重复请求
    requesting: Set<string>;
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
    // 设置翻译引擎
    setEngine: (engine: TranslationEngine) => void;
    
    // 根据句子获取翻译
    getTranslation: (sentences: Sentence[], sentenceIndex: number) => string;
    
    // 根据key获取翻译
    getTranslationByKey: (key: string) => string;
    
    // 懒加载翻译 - 按组预加载当前组和临近组
    loadTranslationGroup: (sentences: Sentence[], currentSentenceIndex: number) => void;
    
    // 更新翻译结果 (由前端Controller调用) - 单个
    updateTranslation: (key: string, translation: string) => void;
    
    // 批量更新翻译结果 (由前端Controller调用) - 数组
    updateTranslations: (translations: Array<{ key: string, translation: string }>) => void;
    
    // 清除翻译缓存
    clearTranslations: () => void;
}

// 创建翻译Store
const useTranslation = create(
    subscribeWithSelector<TranslationState & TranslationActions>((set, get) => ({
        // 初始状态
        engine: 'tencent',
        translations: new Map(),
        requesting: new Set(),

        // 设置翻译引擎
        setEngine: (engine: TranslationEngine) => {
            set({ engine });
        },

        // 根据句子获取翻译
        getTranslation: (sentences: Sentence[], sentenceIndex: number) => {
            const key = generateTranslationKey(sentences, sentenceIndex);
            return get().translations.get(key) || '';
        },

        // 根据key获取翻译
        getTranslationByKey: (key: string) => {
            return get().translations.get(key) || '';
        },

        // 懒加载翻译 - 基于现有的transGroup字段按组预加载
        loadTranslationGroup: (sentences: Sentence[], currentSentenceIndex: number) => {
            const state = get();
            const currentSentence = sentences[currentSentenceIndex];
            if (!currentSentence) return;

            const currentGroup = currentSentence.transGroup;
            
            // 要加载的组：当前组、上一组、下一组
            const groupsToLoad = [
                Math.max(1, currentGroup - 1),  // 上一组 (transGroup从1开始)
                currentGroup,                    // 当前组
                currentGroup + 1                 // 下一组
            ];
            
            const keysToRequest: string[] = [];
            const sentencesToTranslate: Array<{key: string, sentences: string[]}> = [];
            
            for (const groupNum of groupsToLoad) {
                // 找到属于该组的所有句子
                const groupSentences = sentences.filter(s => s.transGroup === groupNum);
                
                for (const sentence of groupSentences) {
                    const key = generateTranslationKey(sentences, sentence.index);
                    
                    // 检查是否已有翻译或正在请求
                    if (!state.translations.has(key) && !state.requesting.has(key)) {
                        keysToRequest.push(key);
                        
                        // 获取附近三行文本
                        const contextStart = Math.max(0, sentence.index - 1);
                        const contextEnd = Math.min(sentences.length - 1, sentence.index + 1);
                        const contextSentences = [];
                        for (let i = contextStart; i <= contextEnd; i++) {
                            contextSentences.push(sentences[i]?.text || '');
                        }
                        
                        sentencesToTranslate.push({
                            key,
                            sentences: contextSentences
                        });
                    }
                }
            }
            
            if (keysToRequest.length === 0) {
                return; // 没有需要翻译的内容
            }
            
            // 标记为正在请求
            set(state => ({
                ...state,
                requesting: new Set([...state.requesting, ...keysToRequest])
            }));
            
            // 异步调用后端API (立即返回，不等待结果)
            api.call('ai-trans/request-group-translation', {
                engine: state.engine,
                translations: sentencesToTranslate
            }).catch(error => {
                console.error('Group translation request failed:', error);
                
                // 移除请求标记
                set(state => {
                    const newRequesting = new Set(state.requesting);
                    keysToRequest.forEach(key => newRequesting.delete(key));
                    return {
                        ...state,
                        requesting: newRequesting
                    };
                });
            });
        },

        // 更新单个翻译结果 (由前端Controller调用)
        updateTranslation: (key: string, translation: string) => {
            set(state => {
                const newTranslations = new Map(state.translations);
                const newRequesting = new Set(state.requesting);
                
                newTranslations.set(key, translation);
                newRequesting.delete(key);
                
                return {
                    ...state,
                    translations: newTranslations,
                    requesting: newRequesting
                };
            });
        },

        // 批量更新翻译结果 (由前端Controller调用)
        updateTranslations: (translations: Array<{ key: string, translation: string }>) => {
            set(state => {
                const newTranslations = new Map(state.translations);
                const newRequesting = new Set(state.requesting);
                
                translations.forEach(({ key, translation }) => {
                    newTranslations.set(key, translation);
                    newRequesting.delete(key);
                });
                
                return {
                    ...state,
                    translations: newTranslations,
                    requesting: newRequesting
                };
            });
        },

        // 清除翻译缓存
        clearTranslations: () => {
            set({
                translations: new Map(),
                requesting: new Set()
            });
        }
    }))
);

export default useTranslation;