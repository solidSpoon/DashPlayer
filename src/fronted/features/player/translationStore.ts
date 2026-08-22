import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import hash from 'object-hash';
import { RendererTranslationItem, TranslationMode } from '@/common/types/TranslationResult';
import { playerApi } from '@/fronted/features/player/playerApi';
import { getRendererLogger } from '@/fronted/log/simple-logger';

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
    /** 已返回且可直接展示的最终翻译文本。 */
    translations: Map<string, string>;
}

/**
 * 字幕翻译状态动作。
 */
export interface TranslationActions {
    /**
     * 用启动时的运行时设置快照初始化字幕翻译配置。
     *
     * 此操作不释放当前字幕会话：首屏字幕可能已完成解析，但此时还未提交
     * 翻译需求。若异步释放会话，会与随后提交的首个需求发生竞态。
     *
     * @param engine 启动快照中的字幕翻译引擎。
     * @param mode 启动快照中的 OpenAI 字幕模式。
     */
    initializeRuntimeSettings: (
        engine: 'tencent' | 'openai' | 'none',
        mode: TranslationMode
    ) => void;

    /**
     * 向后端报告当前播放位置。
     *
     * @param fileHash 字幕文件哈希。
     * @param currentIndex 当前播放字幕索引。
     */
    requestTranslation: (fileHash: string, currentIndex: number) => void;

    /**
     * 批量接收后端返回的最终翻译。
     *
     * @param translations 当前批次翻译结果。
     */
    updateTranslations: (translations: RendererTranslationItem[]) => void;

    /**
     * 清除当前字幕翻译上下文。
     */
    clearTranslations: () => void;

    /**
     * 设置字幕翻译引擎。
     *
     * @param engine 新翻译引擎。
     */
    setEngine: (engine: 'tencent' | 'openai' | 'none') => void;

    /**
     * 设置 OpenAI 字幕模式。
     *
     * @param mode 新字幕模式。
     */
    setOpenAiMode: (mode: TranslationMode) => void;

    /**
     * 设置当前激活的字幕文件哈希。
     *
     * @param fileHash 新字幕文件哈希；无字幕时为 null。
     */
    setActiveFileHash: (fileHash: string | null) => void;
}

const logger = getRendererLogger('useTranslation');

/** 保证后端只接受最新播放位置的全局递增需求标记。 */
let nextSubtitleDemandId = 1;

/**
 * 通知后端释放指定字幕文件的翻译会话。
 *
 * @param fileHash 待释放的字幕文件哈希。
 */
const releaseSession = (fileHash: string | null): void => {
    if (!fileHash) {
        return;
    }
    playerApi.releaseSubtitleTranslationSession(fileHash).catch((error) => {
        logger.error('release subtitle translation session failed', {
            fileHash,
            error,
        });
    });
};

/**
 * 展示前端提交字幕需求失败的提示。
 *
 * @param engine 当前翻译引擎。
 * @param error 原始异常。
 */
const showRequestFailure = (
    engine: TranslationState['engine'],
    error: unknown
): void => {
    logger.error('subtitle translation demand request failed', { error });
    const message = error instanceof Error ? error.message : String(error);
    window.dispatchEvent(new CustomEvent('show-toast', {
        detail: {
            title: '字幕翻译失败',
            message,
            variant: 'error',
            position: 'top-left',
            bubble: true,
            dedupeKey: `subtitle-translation-request:${engine}:${hash(message)}`,
        },
    }));
};

const useTranslation = create(
    subscribeWithSelector<TranslationState & TranslationActions>((set, get) => ({
        engine: 'none',
        openAiMode: 'zh',
        activeFileHash: null,
        translations: new Map(),

        initializeRuntimeSettings: (engine, openAiMode) => {
            const state = get();
            set({
                ...state,
                engine,
                openAiMode,
                translations: new Map(),
            });
        },

        requestTranslation: (fileHash: string, currentIndex: number) => {
            const state = get();
            if (state.engine === 'none' || state.activeFileHash !== fileHash) {
                logger.warn('subtitle translation request skipped by state guard', {
                    fileHash,
                    currentIndex,
                    activeFileHash: state.activeFileHash,
                    engine: state.engine,
                });
                return;
            }
            const demandId = nextSubtitleDemandId;
            nextSubtitleDemandId += 1;
            logger.info('subtitle translation request sent', {
                fileHash,
                currentIndex,
                demandId,
                engine: state.engine,
                openAiMode: state.openAiMode,
            });
            playerApi.updateSubtitleTranslationDemand(fileHash, currentIndex, demandId)
                .catch((error) => showRequestFailure(state.engine, error));
        },

        updateTranslations: (items: RendererTranslationItem[]) => {
            set((state) => {
                const accepted = items.filter((item) =>
                    shouldAcceptTranslation(state, item)
                );
                if (accepted.length === 0) {
                    return state;
                }

                const translations = new Map(state.translations);
                accepted.forEach((item) => {
                    translations.set(item.key, item.translation);
                });
                return {
                    ...state,
                    translations,
                };
            });
        },

        clearTranslations: () => {
            const activeFileHash = get().activeFileHash;
            releaseSession(activeFileHash);
            set({
                activeFileHash: null,
                translations: new Map(),
            });
        },

        setEngine: (engine: TranslationState['engine']) => {
            const state = get();
            if (state.engine === engine) {
                return;
            }
            releaseSession(state.activeFileHash);
            set({
                ...state,
                engine,
                translations: new Map(),
            });
        },

        setOpenAiMode: (mode: TranslationMode) => {
            const state = get();
            if (state.openAiMode === mode) {
                return;
            }
            if (state.engine === 'openai') {
                releaseSession(state.activeFileHash);
            }
            set({
                ...state,
                openAiMode: mode,
                translations: state.engine === 'openai'
                    ? new Map()
                    : state.translations,
            });
        },

        setActiveFileHash: (fileHash: string | null) => {
            const state = get();
            if (state.activeFileHash === fileHash) {
                return;
            }
            releaseSession(state.activeFileHash);
            set({
                ...state,
                activeFileHash: fileHash,
                translations: new Map(),
            });
        },
    }))
);

/**
 * 判断后端翻译结果是否属于当前激活的字幕配置。
 *
 * @param state 当前翻译状态。
 * @param item 后端返回的翻译条目。
 * @returns 文件、引擎和模式均匹配时返回 true。
 */
const shouldAcceptTranslation = (
    state: TranslationState,
    item: RendererTranslationItem
): boolean => {
    if (item.provider !== state.engine || state.activeFileHash !== item.fileHash) {
        return false;
    }
    if (item.provider === 'openai') {
        return (item.mode ?? 'zh') === state.openAiMode;
    }
    return true;
};

export default useTranslation;
