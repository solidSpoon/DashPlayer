import {useEffect, useRef, useState} from 'react';
import * as turf from '@turf/turf';
import {Feature, Polygon} from '@turf/turf';
import WordPop from './word-pop';
import {playUrl, playWord, getTtsUrl, playAudioUrl} from '@/common/utils/AudioPlayer';
import { YdRes, OpenAIDictionaryResult } from '@/common/types/YdRes';
import usePlayerController from '../../../hooks/usePlayerController';
import useSWR from "swr";
import Style from "@/fronted/styles/style";
import {cn} from "@/fronted/lib/utils";
import useCopyModeController from '../../../hooks/useCopyModeController';
import StrUtil from '@/common/utils/str-util';
import Eb from '@/fronted/components/Eb';

const api = window.electron;
export interface WordParam {
    word: string;
    original: string;
    pop: boolean;
    requestPop: () => void;
    show: boolean;
    alwaysDark?: boolean;
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
const Word = ({word, original, pop, requestPop, show, alwaysDark}: WordParam) => {
    const setCopyContent = useCopyModeController((s)=>s.setCopyContent);
    const isCopyMode = useCopyModeController((s)=>s.isCopyMode);
    const pause = usePlayerController((s) => s.pause);
    const [hovered, setHovered] = useState(false);
    const [playLoading, setPlayLoading] = useState(false);
    const {data: ydResp, isLoading: isWordLoading} = useSWR(hovered && !isCopyMode? ['ai-trans/word', original] : null, ([_apiName, word]) => api.call('ai-trans/word', word));
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
            if (isYoudaoFormat(ydResp)) {
                url = ydResp?.speakUrl || '';
            }
            
            console.log('url', url);
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
            console.error('发音播放失败:', error);
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
                            translation={ydResp}
                            ref={popperRef}
                            hoverColor={alwaysDark ? "bg-neutral-600" : "bg-stone-100 dark:bg-neutral-600"}
                            isLoading={isWordLoading}
                        />
                    </Eb>
                ) : (
                    <div
                        className={cn(
                            'rounded select-none',
                            !show && ['text-transparent', Style.word_hover_bg],
                            alwaysDark ? 'hover:bg-neutral-600' : 'hover:bg-stone-100 dark:hover:bg-neutral-600'
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
