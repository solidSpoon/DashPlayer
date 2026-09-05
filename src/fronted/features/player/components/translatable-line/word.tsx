import React, { useEffect, useRef, useState } from 'react';
import booleanPointInPolygon from '@turf/boolean-point-in-polygon';
import convex from '@turf/convex';
import {
    featureCollection,
    point,
    polygon,
    type Feature,
    type Polygon,
} from '@turf/helpers';
import toast from 'react-hot-toast';
import { useTranslation } from 'react-i18next';
import WordPop from './word-pop';
import { playUrl, playWord, getTtsUrl, playAudioUrl } from '@/fronted/infrastructure/audio/AudioPlayer';
import { YdRes, OpenAIDictionaryResult } from '@/common/types/YdRes';
import useSWR from 'swr';
import Style from '@/fronted/styles/style';
import { cn } from '@/fronted/lib/utils';
import StrUtil from '@/common/utils/str-util';
import { getRendererLogger } from '@/fronted/log/simple-logger';
import Eb from '@/fronted/components/shared/common/Eb';
import useVocabulary from '@/fronted/features/player/vocabularyStore';
import { useTransLineTheme } from './translatable-theme';
import { usePlayer } from '@/fronted/features/player/playerStore';
import useDictionaryStream, { createDictionaryRequestId } from '@/fronted/features/player/dictionaryStore';
import useSetting from '@/fronted/features/settings/settingsStore';
import { playerApi } from '@/fronted/features/player/playerApi';
import { videoLearningApi } from '@/fronted/features/video-learning/videoLearningApi';

const logger = getRendererLogger('Word');

/** OpenAI 词典词性到缩写的映射；未知词性保留原文。 */
const PART_OF_SPEECH_ABBR: Record<string, string> = {
    noun: 'n.',
    verb: 'v.',
    adjective: 'adj.',
    adverb: 'adv.',
    preposition: 'prep.',
    conjunction: 'conj.',
    pronoun: 'pron.',
    interjection: 'int.',
    numeral: 'num.',
};

const isOpenAIDictionaryResult = (data: unknown): data is OpenAIDictionaryResult => {
    return typeof data === 'object' && data !== null && 'definitions' in data;
};

const isYoudaoResult = (data: unknown): data is YdRes => {
    return typeof data === 'object' && data !== null && 'speakUrl' in data;
};

/**
 * 从弹窗词典结果中提取简明中文释义。
 *
 * 收藏时把已查到的释义一并传给后端入库，避免后端再调一次词典 AI。
 *
 * @param data 弹窗当前的词典结果；可能还在加载中或已失败。
 * @returns 可入库的释义文本；提取不到时返回空字符串，由后端自行生成。
 */
const buildFavoriteTranslate = (data: YdRes | OpenAIDictionaryResult | null | undefined): string => {
    if (!data || typeof data !== 'object') {
        return '';
    }
    if (isOpenAIDictionaryResult(data)) {
        return data.definitions
            .map((definition) => {
                const abbr = PART_OF_SPEECH_ABBR[definition.partOfSpeech] ?? definition.partOfSpeech;
                return `${abbr} ${definition.meaning}`.trim();
            })
            .filter((entry) => entry.length > 0)
            .join('；');
    }
    if (isYoudaoResult(data)) {
        return data.basic?.explains?.join('；') || data.translation?.join('；') || '';
    }
    return '';
};

export interface WordParam {
    word: string;
    original: string;
    lemma?: string;
    pop: boolean;
    requestPop: () => void;
    show: boolean;
    alwaysDark?: boolean;
    classNames?: {
        word?: string;    // 单词文本容器（非弹层）
        hover?: string;   // 覆盖 hover 背景
        vocab?: string;   // 覆盖词汇高亮
    };
}

/**
 * 以左上角为原点，顺时针旋转
 */
export const getBox = (ele: HTMLElement): Feature<Polygon> => {
    if (!ele) {
        return polygon([[]]);
    }
    const rect = ele.getBoundingClientRect();
    const number = 2;
    return polygon([
        [
            [rect.left - number, rect.top - number],
            [rect.right + number, rect.top - number],
            [rect.right + number, rect.bottom + number],
            [rect.left - number, rect.bottom + number],
            [rect.left - number, rect.top - number],
        ],
    ]);
};
/**
 * 渲染单个字幕原文词，并使用 lemma 判断生词高亮；词典查询仍传递原文。
 * @param props 字幕词原文、lemma 及交互状态。
 */
const Word = ({word, original, lemma, pop, requestPop, show, alwaysDark, classNames}: WordParam) => {
    const pause = usePlayer((s) => s.pause);
    const vocabularyStore = useVocabulary();
    const { t } = useTranslation('common');
    const [hovered, setHovered] = useState(false);
    const [playLoading, setPlayLoading] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    // 收藏状态：idle 未收藏；saving 提交中；saved 已加入收藏
    const [favoriteState, setFavoriteState] = useState<'idle' | 'saving' | 'saved'>('idle');
    const [referenceElement, setReferenceElement] = useState<HTMLSpanElement | null>(null);

    const theme = useTransLineTheme();

    // 检查是否是词汇单词
    const cleanWord = (lemma ?? word).toLowerCase().trim();
    const isVocabularyWord = cleanWord && vocabularyStore.isVocabularyWord(cleanWord);

    const hoverBg = classNames?.hover ?? (alwaysDark ? 'hover:bg-neutral-600' : theme.word.hoverBgClass);
    const vocabCls = isVocabularyWord ? (classNames?.vocab ?? theme.word.vocabHighlightClass) : undefined;
    const setting = useSetting((state) => state.setting);
    const dictionaryEngineRaw = setting('providers.dictionary');
    const dictionaryEngine =
        dictionaryEngineRaw === 'youdao' || dictionaryEngineRaw === 'openai'
            ? dictionaryEngineRaw
            : 'openai';
    const openaiDictionaryEnabled = dictionaryEngine === 'openai';
    const dictionaryMode = dictionaryEngine;

    const dictionaryEntry = useDictionaryStream((state) => state.getActiveEntry(original));

    const shouldFetch = hovered;

    const {
        data: dictionaryResponse,
        isLoading: isWordLoading,
        mutate
    } = useSWR(
        shouldFetch ? ['ai-trans/word', original, dictionaryMode] : null,
        async ([_apiName, wordParam]) => {
            const targetWord = wordParam as string;
            const requestId = openaiDictionaryEnabled ? createDictionaryRequestId(targetWord) : '';

            if (openaiDictionaryEnabled) {
                useDictionaryStream.getState().startRequest(targetWord, requestId);
            }

            try {
                const result = await playerApi.translateWord({
                    word: targetWord,
                    forceRefresh: false,
                    requestId: openaiDictionaryEnabled ? requestId : undefined
                });

                if (openaiDictionaryEnabled) {
                    const isOpenAIDictionary = !!result && typeof result === 'object' && 'definitions' in result;
                    useDictionaryStream.getState().setFinalResult(
                        targetWord,
                        requestId,
                        isOpenAIDictionary ? result as OpenAIDictionaryResult : null
                    );
                }

                return result;
            } catch (error) {
                if (openaiDictionaryEnabled) {
                    useDictionaryStream.getState().setFinalResult(targetWord, requestId, null);
                }
                throw error;
            }
        }
    );

    const handleRefresh = async () => {
        setIsRefreshing(true);
        const requestId = openaiDictionaryEnabled ? createDictionaryRequestId(original) : '';

        if (openaiDictionaryEnabled) {
            useDictionaryStream.getState().startRequest(original, requestId);
        }

        try {
            const newData = await playerApi.translateWord({
                word: original,
                forceRefresh: true,
                requestId: openaiDictionaryEnabled ? requestId : undefined
            });

            if (openaiDictionaryEnabled) {
                const isOpenAIDictionary = !!newData && typeof newData === 'object' && 'definitions' in newData;
                useDictionaryStream.getState().setFinalResult(
                    original,
                    requestId,
                    isOpenAIDictionary ? newData as OpenAIDictionaryResult : null
                );
            }

            mutate(newData, { revalidate: false });
        } catch (error) {
            logger.error('failed to refresh dictionary result', { error: error instanceof Error ? error.message : error });
            if (openaiDictionaryEnabled) {
                useDictionaryStream.getState().setFinalResult(original, requestId, null);
            }
        } finally {
            setIsRefreshing(false);
        }
    };

    /**
     * 切换收藏：未收藏时加入词汇工坊，已收藏时从词表移除。
     *
     * 行为说明：
     * - 收藏：传递点击原文与弹窗已查到的释义，由后端还原为原始形态后入库；
     * - 取消收藏：传递点击原文由后端删除，成功后同步移除前端生词高亮词表，
     *   词表版本变化会触发裁切状态自动重检；
     * - 词表中的词（含默认词表）取消收藏即从词表删除，与词汇工坊删除同义。
     */
    const handleFavorite = async () => {
        const favorited = isVocabularyWord || favoriteState === 'saved';
        if (favoriteState === 'saving') {
            return;
        }

        const previousState = favoriteState;
        setFavoriteState('saving');
        try {
            if (favorited) {
                const result = await videoLearningApi.deleteWord(original);
                if (result.success) {
                    const localBase = vocabularyStore.getBaseWord(cleanWord);
                    vocabularyStore.removeVocabularyWords([
                        ...(result.data ? [result.data.word] : []),
                        ...(localBase ? [localBase] : [])
                    ]);
                    setFavoriteState('idle');
                    toast.success(t('wordUnfavorited'));
                } else {
                    setFavoriteState(previousState);
                    toast.error(result.error || t('unfavoriteWordFailed'));
                }
                return;
            }

            const result = await videoLearningApi.favoriteWord(original, buildFavoriteTranslate(dictionaryResponse));
            if (result.success && result.data) {
                vocabularyStore.addVocabularyWords([result.data.word]);
                setFavoriteState('saved');
                toast.success(result.data.alreadyExists ? t('wordAlreadyFavorited') : t('wordFavorited'));
            } else {
                setFavoriteState('idle');
                toast.error(result.error || t('favoriteWordFailed'));
            }
        } catch (error) {
            logger.error('failed to toggle favorite word', { error: error instanceof Error ? error.message : error });
            setFavoriteState(previousState);
            toast.error(favorited ? t('unfavoriteWordFailed') : t('favoriteWordFailed'));
        }
    };

    const eleRef = useRef<HTMLSpanElement | null>(null);
    const popperRef = useRef<HTMLDivElement | null>(null);
    const resquested = useRef(false);

    /**
     * 判断当前是否存在与该单词相关的有效选区。
     *
     * 说明：
     * - 拖拽复制完成后会产生非折叠选区，此时不应触发发音。
     * - 双击被拦截后，正常单击不会留下选区，因此不影响点按发音。
     */
    const hasMeaningfulSelection = (target: HTMLElement): boolean => {
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0 || selection.isCollapsed) {
            return false;
        }

        return selection.containsNode(target, true);
    };

    useEffect(() => {
        // 如果鼠标移出了凸多边形，就关闭
        let timeout: NodeJS.Timeout;
        const mouseEvent = (e: MouseEvent) => {
            if (!eleRef?.current) {
                return;
            }
            const wordELe = getBox(eleRef.current!);
            const popper = getBox(popperRef.current ?? eleRef.current!);
            const hull = convex(featureCollection([wordELe, popper]));
            const pt = point([e.clientX, e.clientY]);

            const b = booleanPointInPolygon(pt, hull!);
            clearTimeout(timeout);
            if (!b) {
                setHovered(false);
                return;
            }
            timeout = setTimeout(() => {
                if (!resquested.current) {
                    resquested.current = true;
                    requestPop();
                }
            }, 50);
        };
        if (hovered) {
            document.addEventListener('mousemove', mouseEvent);
        } else {
            resquested.current = false;
        }
        return () => {
            document.removeEventListener('mousemove', mouseEvent);
            clearTimeout(timeout);
        };
    }, [hovered, requestPop]);

    /**
     * 单击单词时播放发音；若用户刚通过拖拽产生选区，则跳过播放。
     */
    const playWordAudio = async () => {
        if (playLoading) return;

        setPlayLoading(true);
        try {
            const isYoudaoFormat = (data: unknown): data is YdRes => {
                return typeof data === 'object' && data !== null && 'speakUrl' in data;
            };

            let url = '';
            if (isYoudaoFormat(dictionaryResponse)) {
                url = dictionaryResponse?.speakUrl || '';
            }

            logger.debug('TTS URL generated', { url });
            if (StrUtil.isNotBlank(url)) {
                await playUrl(url);
            } else {
                const ttsUrl = await getTtsUrl(word);
                if (ttsUrl) {
                    await playAudioUrl(ttsUrl);
                } else {
                    await playWord(word);
                }
            }
        } catch (error) {
            logger.error('failed to play pronunciation', { error: error instanceof Error ? error.message : error });
        } finally {
            setPlayLoading(false);
        }
    };

    /**
     * 单击单词时播放发音；若用户刚通过拖拽产生选区，则跳过播放。
     *
     * 单词点击已被“播放发音”消费，需阻止事件冒泡，
     * 避免再触发父级字幕行的点击行为（如播客模式的“跳转到行首”）。
     */
    const handleWordClick = async (event: React.MouseEvent<HTMLSpanElement>) => {
        event.stopPropagation();
        if (hasMeaningfulSelection(event.currentTarget)) {
            return;
        }
        await playWordAudio();
    };

    const setWordRef = (node: HTMLSpanElement | null) => {
        eleRef.current = node;
        setReferenceElement(node);
    };

    return (
        <span className="inline">
            <span
                ref={setWordRef}
                className="rounded cursor-pointer inline"
                role="button"
                tabIndex={0}
                onFocus={() => {
                    setHovered(true);
                }}
                onMouseOver={() => {
                    setHovered(true);
                    pause();
                }}
                onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        void playWordAudio();
                        if (!hovered) {
                            setHovered(true);
                        }
                    }
                }}
                onClick={(e) => {
                    void handleWordClick(e);
                    if (!hovered) {
                        setHovered(true);
                    }
                }}
            >
                <span
                    className={cn(
                        'rounded select-text transition-all duration-150',
                        !show && ['text-transparent', Style.word_hover_bg],
                        show && hoverBg,
                        show && vocabCls,
                        hovered && pop && (alwaysDark ? 'bg-neutral-600' : theme.word.popReferenceBgClass),
                        classNames?.word,
                    )}
                >
                    {word}
                </span>
            </span>
            {pop && hovered ? (
                <Eb>
                    <WordPop
                        translation={dictionaryResponse}
                        referenceElement={referenceElement}
                        ref={popperRef}
                        isLoading={isWordLoading || isRefreshing}
                        openaiStreamingData={openaiDictionaryEnabled ? dictionaryEntry?.data : null}
                        isStreaming={openaiDictionaryEnabled && !!dictionaryEntry && !dictionaryEntry.isComplete}
                        onRefresh={handleRefresh}
                        onFavorite={handleFavorite}
                        isFavorited={isVocabularyWord || favoriteState === 'saved'}
                        isFavoriting={favoriteState === 'saving'}
                    />
                </Eb>
            ) : null}
        </span>
    );
};

export default Word;

Word.defaultProps = {
    alwaysDark: false,
}
