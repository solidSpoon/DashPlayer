import React, { useEffect, useRef, useState } from 'react';
// @ts-ignore
import * as turf from '@turf/turf';
// @ts-ignore
import { Feature, Polygon } from '@turf/turf';
import WordPop from './word-pop';
import { playUrl, playWord, getTtsUrl, playAudioUrl } from '@/common/utils/AudioPlayer';
import { YdRes, OpenAIDictionaryResult } from '@/common/types/YdRes';
import useSWR from 'swr';
import Style from '@/fronted/styles/style';
import { cn } from '@/fronted/lib/utils';
import StrUtil from '@/common/utils/str-util';
import { getRendererLogger } from '@/fronted/log/simple-logger';
import Eb from '@/fronted/components/shared/common/Eb';
import useVocabulary from '@/fronted/hooks/useVocabulary';
import { useTransLineTheme } from './translatable-theme';
import { usePlayer } from '@/fronted/hooks/usePlayer';
import useDictionaryStream, { createDictionaryRequestId } from '@/fronted/hooks/useDictionaryStream';
import useSetting from '@/fronted/hooks/useSetting';
import { backendClient } from '@/fronted/application/bootstrap/backendClient';
import { useToast } from '@/fronted/components/ui/use-toast';

const api = backendClient;
const logger = getRendererLogger('Word');

/** 从 OpenAIDictionaryResult 中提取简短释义（用于生词本） */
const extractTranslate = (data: OpenAIDictionaryResult | null | undefined): string | undefined => {
    if (!data || !Array.isArray(data.definitions) || data.definitions.length === 0) {
        return undefined;
    }
    return data.definitions
        .slice(0, 3)
        .map((d) => {
            const prefix = d.partOfSpeech ? `${d.partOfSpeech}. ` : '';
            return `${prefix}${d.meaning}`;
        })
        .join('；');
};
export interface WordParam {
    word: string;
    original: string;
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
        return turf.polygon([[]]);
    }
    const rect = ele.getBoundingClientRect();
    const number = 2;
    return turf.polygon([
        [
            [rect.left - number, rect.top - number],
            [rect.right + number, rect.top - number],
            [rect.right + number, rect.bottom + number],
            [rect.left - number, rect.bottom + number],
            [rect.left - number, rect.top - number],
        ],
    ]);
};
const Word = ({word, original, pop, requestPop, show, alwaysDark = false, classNames}: WordParam) => {
    const pause = usePlayer((s) => s.pause);
    const vocabularyStore = useVocabulary();
    const { toast } = useToast();
    const [hovered, setHovered] = useState(false);
    const [playLoading, setPlayLoading] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const theme = useTransLineTheme();

    // 检查是否是词汇单词
    const cleanWord = word.toLowerCase().replace(/[^\w-]/g, '');
    const isVocabularyWord = !!cleanWord && vocabularyStore.isVocabularyWord(cleanWord);

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
                const result = await api.call('ai-trans/word', {
                    word: targetWord,
                    forceRefresh: false,
                    requestId: openaiDictionaryEnabled ? requestId : undefined
                });

                if (openaiDictionaryEnabled) {
                    const isOpenAIDictionary = !!result && typeof result === 'object' && 'definitions' in (result as unknown as Record<string, unknown>);
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

    logger.debug('word loading status', { isWordLoading, hasDictionaryResponse: !!dictionaryResponse });

    const handleRefresh = async () => {
        setIsRefreshing(true);
        const requestId = openaiDictionaryEnabled ? createDictionaryRequestId(original) : '';

        if (openaiDictionaryEnabled) {
            useDictionaryStream.getState().startRequest(original, requestId);
        }

        try {
            const newData = await api.call('ai-trans/word', {
                word: original,
                forceRefresh: true,
                requestId: openaiDictionaryEnabled ? requestId : undefined
            });

            if (openaiDictionaryEnabled) {
                const isOpenAIDictionary = !!newData && typeof newData === 'object' && 'definitions' in (newData as unknown as Record<string, unknown>);
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

    /** 将当前单词加入收藏生词本 */
    const handleAddToVocabulary = async (wordToAdd: string, translate?: string) => {
        const normalized = wordToAdd.trim().toLowerCase();
        try {
            const result = await api.call('vocabulary/add', { word: normalized, translate });
            if (result.success) {
                vocabularyStore.addVocabularyWords([normalized]);
                toast({ title: '已收藏', description: `「${normalized}」已加入生词本` });
            } else {
                toast({ title: '收藏失败', description: result.message, variant: 'destructive' });
            }
        } catch (error) {
            logger.error('收藏单词失败', { error: error instanceof Error ? error.message : error });
            toast({ title: '收藏失败', description: error instanceof Error ? error.message : String(error), variant: 'destructive' });
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
            const hull = turf.convex(turf.featureCollection([wordELe, popper]));
            const point = turf.point([e.clientX, e.clientY]);

            const b = turf.booleanPointInPolygon(point, hull!);
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
    const handleWordClick = async (event: React.MouseEvent<HTMLSpanElement>) => {
        if (hasMeaningfulSelection(event.currentTarget)) {
            return;
        }

        if (playLoading) return;

        setPlayLoading(true);
        try {
            const isYoudaoFormat = (data: any): data is YdRes => {
                return data && 'speakUrl' in data;
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

    return (
        <span>
            <span
                ref={eleRef}
                className="rounded cursor-pointer"
                onMouseOver={() => {
                    setHovered(true);
                    pause();
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
                        'rounded select-text',
                        !show && ['text-transparent', Style.word_hover_bg],
                        hoverBg,
                        hovered && pop && (alwaysDark ? 'bg-neutral-600' : theme.word.popReferenceBgClass),
                        vocabCls,
                        classNames?.word,
                    )}
                >
                    {word}
                </span>
            </span>
            {pop && hovered ? (
                <Eb>
                    <WordPop
                        word={original}
                        translation={dictionaryResponse}
                        referenceElement={eleRef.current}
                        ref={popperRef}
                        isLoading={isWordLoading || isRefreshing}
                        openaiStreamingData={openaiDictionaryEnabled ? dictionaryEntry?.data : null}
                        isStreaming={openaiDictionaryEnabled && !!dictionaryEntry && !dictionaryEntry.isComplete}
                        onRefresh={handleRefresh}
                        onAddToVocabulary={handleAddToVocabulary}
                        isWordInVocabulary={isVocabularyWord}
                    />
                </Eb>
            ) : null}
        </span>
    );
};

export default Word;
