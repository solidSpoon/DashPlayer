import React, { Component, useEffect, useRef, useState } from 'react';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import isVisible from '../lib/isVisible';
import SentenceT from '../lib/param/SentenceT';
import SideSentenceNew from './SideSentenceNew';
import { Action, jump, jumpTime } from '../lib/CallAction';

interface SubtitleSubParam {
    subtitles: SentenceT[];
    currentSentence: SentenceT | undefined;
    onAction: (action: Action) => void;
}

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
const suggestScroll = (boundary: Ele, e: Ele): number => {
    if (e.yt < boundary.yt) {
        return boundary.yt - e.yt;
    }
    if (e.yb > boundary.yb) {
        return boundary.yb - e.yb;
    }
    return 0;
};

/**
 * 元素距离下边界比较近时, 滚动到边界顶部
 * @param boundary
 * @param e
 */
const suggestScroolTop = (boundary: Ele, e: Ele): number => {
    if (e.yb > boundary.yb - 50) {
        return boundary.yt - e.yt;
    }
    return 0;
};

const getEle = (ele: HTMLDivElement): Ele => {
    const rect = ele.getBoundingClientRect();
    return {
        yt: rect.top,
        yb: rect.bottom,
    };
};

export default function Subtitle({
    subtitles,
    currentSentence,
    onAction,
}: SubtitleSubParam) {
    const boundaryRef = useRef<HTMLDivElement>(null);
    const currentRef = useRef<HTMLDivElement>(null);
    const listRef = useRef<VirtuosoHandle>(null);
    const [visibleRange, setVisibleRange] = useState<[number, number]>([0, 0]);
    const [boundary, setBoundary] = useState<Ele | undefined>(undefined);

    const timer = useRef<NodeJS.Timeout | undefined>(undefined);

    useEffect(() => {
        const updateBoundary = () => {
            if (boundaryRef.current !== null) {
                setBoundary(getEle(boundaryRef.current));
            }
        };
        updateBoundary();
        window.addEventListener('resize', updateBoundary);
        return () => {
            window.removeEventListener('resize', updateBoundary);
        };
    }, []);

    useEffect(() => {
        if (!visibleRange || !currentSentence) {
            return;
        }
        if (
            currentSentence.index < visibleRange[0] ||
            currentSentence.index > visibleRange[1]
        ) {
            listRef.current?.scrollToIndex(currentSentence.index);
            return;
        }
        if (!currentRef.current || !boundary) {
            return;
        }
        const currentEle = getEle(currentRef.current);
        const scroll = suggestScroll(boundary, currentEle);
        if (scroll !== 0) {
            listRef.current?.scrollBy({
                top: scroll,
            });
        }

        if (timer.current) {
            clearTimeout(timer.current);
        }
        timer.current = setTimeout(() => {
            const ce = getEle(currentRef.current!);
            const sct = suggestScroolTop(boundary, ce);
            if (sct !== 0) {
                listRef.current?.scrollBy({
                    behavior: 'smooth',
                    top: scroll,
                });
            }
        }, 500);
    }, [boundary, currentSentence, visibleRange]);

    const render = () => {
        return (
            <div className="w-full h-full" ref={boundaryRef}>
                <Virtuoso
                    ref={listRef}
                    className="h-full w-full"
                    data={subtitles}
                    rangeChanged={({ startIndex, endIndex }) => {
                        setVisibleRange([startIndex, endIndex]);
                    }}
                    itemContent={(index, item) => {
                        const isCurrent = item.equals(currentSentence);
                        let result = (
                            <div
                                className={`${index === 0 ? 'pt-3' : ''}
                            ${index === subtitles.length - 1 ? 'pb-52' : ''}`}
                            >
                                <SideSentenceNew
                                    sentence={item}
                                    onClick={(sentence) =>
                                        onAction(jump(sentence))
                                    }
                                    isCurrent={isCurrent}
                                />
                            </div>
                        );
                        if (isCurrent) {
                            result = (
                                <div
                                    key={`${item.getKey()}div`}
                                    ref={currentRef}
                                >
                                    {result}
                                </div>
                            );
                        }
                        return result;
                    }}
                />
            </div>
        );
    };

    return render();
}
