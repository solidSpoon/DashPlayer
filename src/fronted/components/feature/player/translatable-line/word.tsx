import React, { useEffect, useRef, useState } from 'react';
import * as turf from '@turf/turf';
import { Feature, Polygon } from '@turf/turf';
import WordPop from './word-pop';
import { playUrl, playWord, getTtsUrl, playAudioUrl } from '@/common/utils/AudioPlayer';
import { YdRes, OpenAIDictionaryResult } from '@/common/types/YdRes';
import useSWR from 'swr';
import Style from '@/fronted/styles/style';
import { cn } from '@/fronted/lib/utils';
import useCopyModeController from '@/fronted/hooks/useCopyModeController';
import StrUtil from '@/common/utils/str-util';
import { getRendererLogger } from '@/fronted/log/simple-logger';
import Eb from '@/fronted/components/shared/common/Eb';
import useVocabulary from '@/fronted/hooks/useVocabulary';
import { useTransLineTheme } from './translatable-theme';
import { usePlayerV2 } from '@/fronted/hooks/usePlayerV2';
import useDictionaryStream, { createDictionaryRequestId } from '@/fronted/hooks/useDictionaryStream';
import useSetting from '@/fronted/hooks/useSetting';
import { backendClient } from '@/fronted/application/bootstrap/backendClient';

const api = backendClient;
const logger = getRendererLogger('Word');
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
export const getBox = (ele: HTMLDivElement): Feature<Polygon> => {
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
const Word = ({word, original, pop, requestPop, show, alwaysDark, classNames}: WordParam) => {
    const setCopyContent = useCopyModeController((s)=>s.setCopyContent);
    const isCopyMode = useCopyModeController((s)=>s.isCopyMode);
    const pause = usePlayerV2((s) => s.pause);
    const vocabularyStore = useVocabulary();
    const [hovered, setHovered] = useState(false);
    const [playLoading, setPlayLoading] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);

    const theme = useTransLineTheme();

    // 检查是否是词汇单词
    const cleanWord = word.toLowerCase().replace(/[^\w]/g, '');
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

    const shouldFetch = hovered && !isCopyMode;

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
                    const isOpenAIDictionary = !!result && typeof result === 'object' && 'definitions' in (result as Record<string, unknown>);
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
                const isOpenAIDictionary = !!newData && typeof newData === 'object' && 'definitions' in (newData as Record<string, unknown>);
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
    const eleRef = useRef<HTMLDivElement | null>(null);
    const popperRef = useRef<HTMLDivElement | null>(null);
    const resquested = useRef(false);
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
                console.log('mouse moved out of hull, setting hovered to false');
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
            console.log('adding mousemove listener, hovered:', hovered);
            document.addEventListener('mousemove', mouseEvent);
        } else {
            resquested.current = false;
        }
        return () => {
            document.removeEventListener('mousemove', mouseEvent);
            clearTimeout(timeout);
        };
    }, [hovered, requestPop]);

    const handleWordClick = async (e:React.MouseEvent) => {
        if(isCopyMode){
            e.stopPropagation();
            setCopyContent(word);
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
        <div className={cn('flex gap-1')}>
            <div
                ref={eleRef}
                className="rounded select-none"
                onMouseOver={() => {
                    setHovered(true);
                    pause();
                }}
                onClick={(e) => {
                    handleWordClick(e);
                    if (!hovered) {
                        setHovered(true);
                    }
                }}
            >
                {pop && hovered && !isCopyMode ? (
                    <Eb>
                        <WordPop
                            word={word}
                            translation={dictionaryResponse}
                            ref={popperRef}
                            hoverColor={alwaysDark ? 'bg-neutral-600' : theme.word.popReferenceBgClass}
                            isLoading={isWordLoading || isRefreshing}
                            openaiStreamingData={openaiDictionaryEnabled ? dictionaryEntry?.data : null}
                            isStreaming={openaiDictionaryEnabled && !!dictionaryEntry && !dictionaryEntry.isComplete}
                            onRefresh={handleRefresh}
                        />
                    </Eb>
                ) : (
                    <div
                        className={cn(
                            'rounded select-none',
                            !show && ['text-transparent', Style.word_hover_bg],
                            hoverBg,
                            vocabCls,
                            classNames?.word
                        )}
                        onMouseLeave={() => {
                            setHovered(false);
                        }}
                    >
                        {word}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Word;

Word.defaultProps = {
    alwaysDark: false,
}
