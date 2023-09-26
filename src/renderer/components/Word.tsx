import { useEffect, useRef, useState } from 'react';
import * as turf from '@turf/turf';
import { Feature, Polygon } from '@turf/turf';
import { YdRes } from '../lib/param/yd/a';
import WordPop from './WordPop';
import { Action, pause } from '../lib/CallAction';
import { playUrl, playWord } from '../lib/AudioPlayer';

const api = window.electron;

export interface WordParam {
    word: string;
    doAction: (action: Action) => void;
    pop: boolean;
    requestPop: () => void;
    show: boolean;
}
/**
 * 以左上角为原点，顺时针旋转
 */
export const getBox = (ele: HTMLDivElement): Feature<Polygon> => {
    if (!ele) {
        return turf.polygon([[]]);
    }
    const rect = ele.getBoundingClientRect();
    return turf.polygon([
        [
            [rect.left, rect.top],
            [rect.right, rect.top],
            [rect.right, rect.bottom],
            [rect.left, rect.bottom],
            [rect.left, rect.top],
        ],
    ]);
};
const Word = ({ word, doAction, pop, requestPop, show }: WordParam) => {
    const [translationText, setTranslationText] = useState<YdRes | undefined>(
        undefined
    );
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
    }, [hovered, requestPop, word]);

    useEffect(() => {
        const transFun = async (str: string) => {
            const r = await api.transWord(str);
            if (r === null) {
                return;
            }
            setTranslationText(r);
        };
        if (hovered) {
            transFun(word);
        }
    }, [hovered, word]);

    const handleWordClick = async () => {
        let url = '';
        if (translationText?.basic) {
            url =
                translationText.basic['us-speech'] ??
                translationText.basic['uk-speech'] ??
                '';
            await playUrl(url);
        } else {
            await playWord(word);
        }
    };

    return (
        <div
            ref={eleRef}
            className="rounded select-none mt-2"
            onMouseOver={() => {
                console.log('avvv onMouseOver', word);
                setHovered(true);
                doAction(pause());
            }}
            onMouseLeave={() => {
                console.log('avvv onMouseLeave', word);
            }}
            onClick={() => {
                handleWordClick();
            }}
        >
            {pop && hovered && translationText ? (
                <WordPop
                    word={word}
                    translation={translationText}
                    ref={popperRef}
                />
            ) : (
                <div
                    className={`hover:bg-zinc-600 rounded select-none ${
                        show ? 'text-white' : 'text-transparent bg-neutral-600'
                    }`}
                    onMouseLeave={() => {
                        setHovered(false);
                    }}
                >
                    {word}
                </div>
            )}
        </div>
    );
};

export default Word;
