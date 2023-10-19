import React, { useEffect, useRef, useState } from 'react';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import SentenceT from '../lib/param/SentenceT';
import SideSentence from './SideSentence';
import usePlayerController, { jump } from '../hooks/usePlayerController';
import useSubtitle from '../hooks/useSubtitle';

interface Ele {
    /**
     * y 顶部
     */
    yt: number;
    /**
     * y 底部
     */
    yb: number;
}

/**
 * e 超出边界时, 滚动回边界内
 * @param boundary
 * @param e
 */

const suggestScroll = (boundary: Ele, e: Ele): number[] => {
    if (e.yt < boundary.yt) {
        return [e.yt - boundary.yt, 0];
    }
    if (e.yb > boundary.yb) {
        return [e.yb - boundary.yb, boundary.yb - boundary.yt - (e.yb - e.yt)];
    }
    return [0, 0];
};

const getEle = (ele: HTMLDivElement): Ele => {
    const rect = ele.getBoundingClientRect();
    return {
        yt: rect.top,
        yb: rect.bottom,
    };
};

export default function Subtitle() {
    const subtitles = useSubtitle((s) => s.subtitle);
    const singleRepeat = usePlayerController((s) => s.singleRepeat);
    const currentSentence = usePlayerController(
        (state) => state.currentSentence
    );
    // const boundaryRef = useRef<HTMLDivElement>(null);
    const currentRef = useRef<number>(-1);
    const listRef = useRef<VirtuosoHandle>(null);
    const [visibleRange, setVisibleRange] = useState<[number, number]>([0, 0]);
    const [boundary, setBoundary] = useState<Ele | undefined>(undefined);

    const timer = useRef<number | undefined>(undefined);

    const lastCurrentSentence = useRef<SentenceT | undefined>(undefined);
    useEffect(() => {
        const updateBoundary = () => {
            // 窗口高度
            const wh = window.innerHeight;
            // 顶部高度
            setBoundary({
                yt: 7,
                yb: wh - 15,
            });
        };
        updateBoundary();
        window.addEventListener('resize', updateBoundary);
        return () => {
            window.removeEventListener('resize', updateBoundary);
        };
    }, []);

    useEffect(() => {
        if (currentSentence === lastCurrentSentence.current) {
            return;
        }
        lastCurrentSentence.current = currentSentence;

        const idx = currentSentence?.index ?? -1;
        if (idx === -1) {
            return;
        }
        if (idx < visibleRange[0] || idx > visibleRange[1]) {
            listRef.current?.scrollToIndex({
                behavior: 'smooth',
                index: idx,
            });
        }
    }, [visibleRange, currentSentence]);

    const updateCurrentRef = (ref: HTMLDivElement | null, index: number) => {
        const lastIndex = currentRef.current ?? -1;
        currentRef.current = index;
        if (!ref || !boundary) {
            return;
        }
        if (lastIndex === index) {
            return;
        }
        const currentEle = getEle(ref);
        const [scroll, scroolTop] = suggestScroll(boundary, currentEle);
        console.log('scro', scroll, scroolTop);
        if (scroll !== 0) {
            console.log('scroll', scroll, boundary, listRef.current);
            listRef.current?.scrollBy({
                top: scroll,
            });
        }
        if (scroolTop !== 0) {
            if (timer.current) {
                clearTimeout(timer.current);
            }
            timer.current = setTimeout(
                (st: number) => {
                    listRef.current?.scrollToIndex({
                        behavior: 'smooth',
                        index,
                    });
                },
                150,
                [index]
            );
        }
    };

    const render = () => {
        return (
            // <div className="w-full h-full overflow-y-auto" ref={boundaryRef}>
            <Virtuoso
                ref={listRef}
                className="h-full w-full overflow-y-scroll scrollbar-thin  scrollbar-track-scrollbarTrack scrollbar-thumb-scrollbarThumb hover:scrollbar-thumb-scrollbarThumbHover scrollbar-thumb-rounded text-textColor"
                data={subtitles}
                rangeChanged={({ startIndex, endIndex }) => {
                    setVisibleRange([startIndex, endIndex]);
                }}
                itemContent={(index, item) => {
                    const isCurrent = item === currentSentence;
                    let result = (
                        <div
                            className={`${index === 0 ? 'pt-3' : ''}
                            ${index === subtitles.length - 1 ? 'pb-52' : ''}`}
                        >
                            <SideSentence
                                sentence={item}
                                onClick={(sentence) => jump(sentence)}
                                isCurrent={isCurrent}
                                isRepeat={singleRepeat}
                            />
                        </div>
                    );
                    if (isCurrent) {
                        result = (
                            <div
                                key={`${item.getKey()}div`}
                                ref={(ref) =>
                                    updateCurrentRef(
                                        ref,
                                        currentSentence?.index ?? -1
                                    )
                                }
                            >
                                {result}
                            </div>
                        );
                    }
                    return result;
                }}
            />
            // </div>
        );
    };

    return render();
}
