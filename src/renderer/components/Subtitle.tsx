import React, { useEffect, useRef, useState } from 'react';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import { useShallow } from 'zustand/react/shallow';
import { twJoin } from 'tailwind-merge';
import SentenceT from '../lib/param/SentenceT';
import SideSentence from './SideSentence';
import usePlayerController from '../hooks/usePlayerController';
import useSystem from '../hooks/useSystem';
import useLayout from '../hooks/useLayout';

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

const topShouldScroll = (boundary: Ele, e: Ele): boolean => {
    return e.yt < boundary.yt;
};

const suggestScrollBottom = (boundary: Ele, e: Ele): number => {
    if (e.yb > boundary.yb) {
        return e.yb - boundary.yb;
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

export default function Subtitle() {
    const isWindows = useSystem((state) => state.isWindows);
    let showSideBar = useLayout((state) => state.showSideBar);
    const { currentSentence, subtitle, jump, singleRepeat } =
        usePlayerController(
            useShallow((state) => ({
                singleRepeat: state.singleRepeat,
                currentSentence: state.currentSentence,
                subtitle: state.subtitle,
                jump: state.jump,
            }))
        );
    const boundaryRef = useRef<HTMLDivElement>(null);
    const currentRef = useRef<number>(-1);
    const listRef = useRef<VirtuosoHandle>(null);
    const [visibleRange, setVisibleRange] = useState<[number, number]>([0, 0]);
    const [boundary, setBoundary] = useState<Ele | undefined>(undefined);

    const timer = useRef<number | undefined>(undefined);

    const lastCurrentSentence = useRef<SentenceT | undefined>(undefined);
    useEffect(() => {
        const updateBoundary = () => {
            // 窗口高度
            const wh = boundaryRef.current?.getBoundingClientRect().height ?? 0;
            // 顶部高度
            setBoundary({
                yt: isWindows ? 27 : 7,
                yb: wh - 15,
            });
        };
        const timeout = setTimeout(() => {
            updateBoundary();
        }, 5000);
        updateBoundary();
        window.addEventListener('resize', updateBoundary);
        return () => {
            window.removeEventListener('resize', updateBoundary);
            clearTimeout(timeout);
        };
    }, [isWindows, showSideBar]);
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
        if (showSideBar) {
            listRef.current?.scrollToIndex({
                behavior: 'smooth',
                index,
                align: 'start',
            });
            return;
        }
        const currentEle = getEle(ref);
        if (topShouldScroll(boundary, currentEle)) {
            listRef.current?.scrollToIndex({
                index,
            });
        } else {
            const scrollBottom = suggestScrollBottom(boundary, currentEle);
            if (scrollBottom <= 0) {
                return;
            }
            listRef.current?.scrollBy({
                top: scrollBottom,
            });

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
            <div className="w-full h-full" ref={boundaryRef}>
                <Virtuoso
                    increaseViewportBy={200}
                    defaultItemHeight={55}
                    ref={listRef}
                    className={twJoin(
                        'h-full w-full overflow-y-scroll text-textColor',
                        'scrollbar-thumb-scrollbarThumb hover:scrollbar-thumb-scrollbarThumbHover scrollbar-thumb-rounded',
                        'scrollbar-thin scrollbar-track-scrollbarTrack'
                    )}
                    data={subtitle}
                    rangeChanged={({ startIndex, endIndex }) => {
                        setVisibleRange([startIndex, endIndex]);
                    }}
                    itemContent={(_index, item) => {
                        const isCurrent = item === currentSentence;
                        return (
                            <SideSentence
                                sentence={item}
                                onClick={(sentence) => jump(sentence)}
                                isCurrent={isCurrent}
                                isRepeat={singleRepeat}
                                ref={(ref) => {
                                    if (isCurrent) {
                                        updateCurrentRef(
                                            ref,
                                            currentSentence?.index ?? -1
                                        );
                                    }
                                }}
                            />
                        );
                    }}
                    components={{
                        Footer: () => <div className="h-52" />,
                        Header: () => <div className="h-3" />,
                    }}
                />
            </div>
        );
    };

    return render();
}
