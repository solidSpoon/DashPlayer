import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import * as turf from '@turf/turf';
import { Feature, Polygon } from '@turf/turf';
import callApi from '../lib/apis/ApiWrapper';
import { YdRes } from '../lib/param/yd/a';
import WordSub from './WordSub';
import { Action, pause, space } from '../lib/CallAction';

export interface WordParam {
    word: string;
    doAction: (action: Action) => void;
    pop: boolean;
    requestPop: (b: boolean) => void;
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
const Word = ({ word, doAction, pop, requestPop }: WordParam) => {
    console.log('abab render Word', word, pop);
    const [translationText, setTranslationText] = useState<string | undefined>(
        undefined
    );
    const [hovered, setHovered] = useState(false);
    const eleRef = useRef<HTMLDivElement | null>(null);
    const popperRef = useRef<HTMLDivElement | null>(null);
    const resquested = useRef(false);
    const trans = (str: string): void => {
        console.log('click');
        window.electron.ipcRenderer.sendMessage('trans-word', [str]);
        window.electron.ipcRenderer.once('trans-word', () => {
            console.log('trans word success');
        });
    };
    useEffect(() => {
        // 如果鼠标移出了凸多边形，就关闭
        const mouseEvent = (e: MouseEvent) => {
            if (!eleRef?.current) {
                return;
            }
            const wordELe = getBox(eleRef.current!);
            const popper = getBox(popperRef.current ?? eleRef.current!);
            const hull = turf.convex(turf.featureCollection([wordELe, popper]));
            const point = turf.point([e.clientX, e.clientY]);

            const b = turf.booleanPointInPolygon(point, hull!);
            if (!b) {
                setHovered(false);
            }
        };
        if (hovered) {
            if (!resquested.current) {
                resquested.current = true;
                requestPop(true);
            }
            document.addEventListener('mousemove', mouseEvent);
        } else {
            resquested.current = false;
        }
        return () => {
            document.removeEventListener('mousemove', mouseEvent);
        };
    }, [hovered, requestPop, word]);

    useEffect(() => {
        const transFun = async (str: string) => {
            const r = (await callApi('you-dao-translate', [str])) as string;
            if (r === null) {
                return;
            }
            const res = JSON.parse(r) as YdRes;
            setTranslationText(res.translation?.join('\n') ?? '');
        };
        if (hovered) {
            transFun(word);
        }
    }, [hovered, word]);
    return (
        <div
            ref={eleRef}
            className="rounded select-none"
            onMouseOver={() => {
                console.log('avvv onMouseOver', word);
                setHovered(true);
                doAction(pause());
            }}
            onMouseLeave={() => {
                console.log('avvv onMouseLeave', word);
            }}
            onClick={() => trans(word)}
        >
            {pop && hovered ? (
                <WordSub
                    word={word}
                    translation={translationText ?? ''}
                    ref={popperRef}
                />
            ) : (
                <div
                    className="hover:bg-zinc-600"
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
