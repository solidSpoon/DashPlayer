import {useEffect, useRef, useState} from 'react';
import * as turf from '@turf/turf';
import {Feature, Polygon} from '@turf/turf';
import {twMerge} from 'tailwind-merge';
import {useShallow} from 'zustand/react/shallow';
import {YdRes} from '@/common/types/YdRes';
import WordPop from './WordPop';
import {playUrl, playWord} from '@/common/utils/AudioPlayer';
import usePlayerController from '../hooks/usePlayerController';
import useSetting from '../hooks/useSetting';
import { strNotBlank } from '@/common/utils/Util';

const api = window.electron;

export interface WordParam {
    word: string;
    original: string;
    pop: boolean;
    requestPop: () => void;
    show: boolean;
    hoverColor?: string;
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
    const [translationText, setTranslationText] = useState<YdRes | undefined>(
        undefined
    );
    const pause = usePlayerController((s) => s.pause);
    // const {getWordLevel, markWordLevel, showWordLevel} = usePlayerController(
    //     useShallow((s) => ({
    //         getWordLevel: s.getWordLevel,
    //         markWordLevel: s.markWordLevel,
    //         showWordLevel: s.showWordLevel,
    //     }))
    // );
    const [hovered, setHovered] = useState(false);
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

    useEffect(() => {
        let cancel = false;
        const transFun = async (str: string) => {
            const r = await api.call('ai-trans/word', str);
            if (r !== null && !cancel) {
                setTranslationText(r);
            }
        };
        if (hovered) {
            transFun(original);
        }
        return () => {
            cancel = true;
        };
    }, [hovered, original]);

    const handleWordClick = async () => {
        const url = translationText?.speakUrl;
        if (strNotBlank(url)) {
            await playUrl(url);
        } else {
            await playWord(word);
        }
    };

    // const wordLevel = getWordLevel(word);

    return (
        <div className={twMerge('flex gap-1')}>
            <div
                ref={eleRef}
                className="rounded select-none"
                onMouseOver={() => {
                    setHovered(true);
                    pause();
                }}
                onClick={(e) => {
                    handleWordClick();
                    if (!hovered) {
                        setHovered(true);
                    }
                }}
                // onContextMenu={(e) => {
                //     e.stopPropagation();
                //     e.preventDefault();
                //     console.log('onContextMenu');
                //     if (showWordLevel) {
                //         console.log('markWordLevel', wordLevel?.familiar);
                //         markWordLevel(word, !wordLevel?.familiar);
                //     }
                // }}
            >
                {pop && hovered && translationText ? (
                    <WordPop
                        word={word}
                        translation={translationText}
                        ref={popperRef}
                        hoverColor={alwaysDark ? "bg-neutral-600" : "bg-stone-100 dark:bg-neutral-600"}
                    />
                ) : (
                    <div
                        className={twMerge(
                            ' rounded select-none',
                            !show && 'text-transparent bg-wordHoverBackground',
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
            {/* {showWordLevel && wordLevel?.familiar === false && ( */}
            {/*     <div */}
            {/*         className={twMerge( */}
            {/*             'flex items-center pt-2 justify-center text-xl text-textColor/80', */}
            {/*             theme === 'dark' && 'text-amber-400/75', */}
            {/*             !show && 'text-transparent' */}
            {/*         )} */}
            {/*     > */}
            {/*         ({wordLevel.translate}) */}
            {/*     </div> */}
            {/* )} */}
        </div>
    );
};

export default Word;

Word.defaultProps = {
    hoverColor: 'bg-stone-100',
    alwaysDark: false,
}
