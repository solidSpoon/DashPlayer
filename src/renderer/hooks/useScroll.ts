import { useEffect, useRef, useState } from 'react';
import usePlayerController from './usePlayerController';
import { VirtuosoHandle } from 'react-virtuoso';
import SentenceT from '../../common/types/SentenceT';
import useBoundary, { Ele } from './useBoundary';
import useLayout from './useLayout';

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
        yb: rect.bottom
    };
};

export type ScrollState = 'USER_BROWSING' | 'AUTO_SCROLLING' | 'NORMAL';
const useScroll = () => {
    const listRef = useRef<VirtuosoHandle>(null);
    const [visibleRange, setVisibleRange] = useState<[number, number]>([0, 0]);
    const currentRef = useRef<number>(-1);
    const currentSentence = usePlayerController(state => state.currentSentence);
    const lastCurrentSentence = useRef<SentenceT | undefined>(undefined);
    const timer = useRef<number | undefined>(undefined);
    const { boundary, setBoundaryRef } = useBoundary();
    const showSideBar = useLayout(state => state.showSideBar);
    const [scrollState, setScrollState] = useState<ScrollState>('NORMAL');
    const scrollingTimer = useRef<number | NodeJS.Timeout | undefined>(undefined);
    const onAutoScroll = () => {
        setScrollState('AUTO_SCROLLING');
    };

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
            if (scrollState !== 'USER_BROWSING') {
                onAutoScroll();
                listRef.current?.scrollToIndex({
                    behavior: 'smooth',
                    index: idx
                });
            }
        }
    }, [visibleRange, currentSentence, scrollState]);

    const onScrolling = () => {
        if (scrollState === 'NORMAL' || scrollState === 'USER_BROWSING') {
            setScrollState('USER_BROWSING');
            return;
        }
        if (scrollingTimer.current) {
            clearTimeout(scrollingTimer.current);
        }
        scrollingTimer.current = setTimeout(() => {
            setScrollState('NORMAL');
        }, 200);
    };
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
            if (scrollState !== 'USER_BROWSING') {
                onAutoScroll();
                // listRef.current?.scrollToIndex({
                //     behavior: 'smooth',
                //     index,
                //     align: 'start'
                // });
                setTimeout(() => listRef.current?.scrollToIndex({ index }), 0);
            }
            return;
        }
        const currentEle = getEle(ref);
        if (topShouldScroll(boundary, currentEle)) {
            if (scrollState !== "USER_BROWSING") {
                onAutoScroll();
                setTimeout(() => listRef.current?.scrollToIndex({ index }), 0);
            }
        } else {
            const scrollBottom = suggestScrollBottom(boundary, currentEle);
            if (scrollBottom <= 0) {
                return;
            }
            if (scrollState !== 'USER_BROWSING') {
                onAutoScroll();
                // listRef.current?.scrollBy({
                //     top: scrollBottom
                // });
                setTimeout(() => listRef.current?.scrollBy({ top: scrollBottom }), 0);
            }
            if (timer.current) {
                clearTimeout(timer.current);
            }
            if (scrollState !== 'USER_BROWSING') {
                timer.current = setTimeout(
                    (st: number) => {
                        onAutoScroll();
                        listRef.current?.scrollToIndex({
                            behavior: 'smooth',
                            index: st
                        });
                    },
                    150,
                    [index]
                );
            }
        }
    };

    const onUserFinishScrolling = () => {
        onAutoScroll();
        listRef.current?.scrollToIndex({
            behavior: 'smooth',
            index: currentRef.current
        });
        // setScrollState('NORMAL');
    };
    return {
        setVisibleRange,
        setBoundaryRef,
        updateCurrentRef,
        setListRef: listRef,
        onScrolling,
        scrollState,
        onUserFinishScrolling
    };

};

export default useScroll;
