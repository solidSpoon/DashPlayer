import { VirtuosoHandle } from 'react-virtuoso';
import { Ele } from './useBoundary';
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import useLayout from './useLayout';
import usePlayerController from './usePlayerController';

export type ScrollState = 'USER_BROWSING' | 'AUTO_SCROLLING' | 'NORMAL' | 'PAUSE_MEASUREMENT';
export type SubtitleScrollState = {
    internal: {
        virtuoso: VirtuosoHandle | null;
        currentIndex: number;
        currentRef: HTMLDivElement | null;
        scrollStatusTimer: number | undefined | NodeJS.Timeout;
        scrollTopTimer: number | undefined | NodeJS.Timeout;
    };
    scrollState: ScrollState;
    boundary: Ele;
    visibleRange: [number, number];

}
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

const inBoundary = (ref: HTMLDivElement) => {
    const index = useSubtitleScroll.getState().internal.currentIndex;
    const visibleRange = useSubtitleScroll.getState().visibleRange;
    if (index < visibleRange[0] || index > visibleRange[1]) {
        return false;
    }
    const boundary = useSubtitleScroll.getState().boundary;
    const ele = getEle(ref);
    return ele.yt >= boundary.yt && ele.yb <= boundary.yb;
};

export type SubtitleScrollActions = {
    onScrolling: () => void;
    updateCurrentRef: (ref: HTMLDivElement | null, index: number) => void;
    onUserFinishScrolling: () => void;
    setVirtuoso: (virtuoso: VirtuosoHandle) => void;
    updateBoundary: (boundary: Ele) => void;
    updateVisibleRange: (range: [number, number]) => void;
    pauseMeasurement: () => void;
    delaySetNormal: () => void;
}
const delaySetNormal = () => {
    const scrollTimer = useSubtitleScroll.getState().internal.scrollStatusTimer;
    if (scrollTimer) {
        clearTimeout(scrollTimer);
    }
    useSubtitleScroll.getState().internal.scrollStatusTimer = setTimeout(() => {
        useSubtitleScroll.setState({ scrollState: 'NORMAL' });
    }, 300);
};


const useSubtitleScroll = create(
    subscribeWithSelector<SubtitleScrollState & SubtitleScrollActions>((set, get) => ({
        internal: {
            virtuoso: null,
            currentIndex: -1,
            scrollStatusTimer: undefined,
            scrollTopTimer: undefined,
            currentRef: null
        },
        scrollState: 'NORMAL',
        boundary: {
            yt: 0,
            yb: 0
        },
        visibleRange: [0, 0],
        onScrolling: () => {
            const cs = get().scrollState;
            if (cs === 'PAUSE_MEASUREMENT') {
                return;
            }
            if (cs === 'USER_BROWSING') {
                const ref = get().internal.currentRef;
                if (ref && inBoundary(ref)) {
                    set({ scrollState: 'NORMAL' });
                }
                return;
            }
            if (cs === 'NORMAL') {
                const ref = get().internal.currentRef;
                if (ref && !inBoundary(ref)) {
                    set({ scrollState: 'USER_BROWSING' });
                }
                return;
            }
            delaySetNormal();
        },
        updateCurrentRef: (ref: HTMLDivElement | null, index: number) => {
            const lastIndex = get().internal.currentIndex;
            get().internal.currentIndex = index;
            if (!ref || !get().boundary) {
                return;
            }
            get().internal.currentRef = ref;
            if (lastIndex === index) {
                return;
            }
            if (get().scrollState === 'PAUSE_MEASUREMENT') {
                return;
            }
            const showSideBar = useLayout.getState().showSideBar;
            if (showSideBar) {
                if (get().scrollState !== 'USER_BROWSING') {
                    set({ scrollState: 'AUTO_SCROLLING' });
                    setTimeout(() => get().internal.virtuoso?.scrollToIndex({ index }), 0);
                }
                return;
            }
            const currentEle = getEle(ref);
            if (topShouldScroll(get().boundary, currentEle)) {
                if (get().scrollState !== 'USER_BROWSING') {
                    set({ scrollState: 'AUTO_SCROLLING' });
                    setTimeout(() => get().internal.virtuoso?.scrollToIndex({ index }), 0);
                }
            } else {
                const scrollBottom = suggestScrollBottom(get().boundary, currentEle);
                if (scrollBottom <= 0) {
                    if (get().scrollState === 'USER_BROWSING') {
                        if (inBoundary(ref)) {
                            set({ scrollState: 'NORMAL' });
                        }
                    }
                    return;
                }
                if (get().scrollState !== 'USER_BROWSING') {
                    set({ scrollState: 'AUTO_SCROLLING' });
                    setTimeout(() => get().internal.virtuoso?.scrollBy({ top: scrollBottom }), 0);
                }
                if (get().internal.scrollStatusTimer) {
                    clearTimeout(get().internal.scrollStatusTimer);
                }
                if (get().scrollState !== 'USER_BROWSING') {
                    console.log('aaa scroll');
                    get().internal.scrollTopTimer = setTimeout(({ indx }) => {
                        console.log('scroll to index', indx);
                        set({ scrollState: 'AUTO_SCROLLING' });
                        get().internal.virtuoso?.scrollToIndex({
                            behavior: 'smooth',
                            index: indx
                        });
                    }, 150, { indx: index });
                }
            }
        },
        onUserFinishScrolling: () => {
            set({ scrollState: 'AUTO_SCROLLING' });
            get().internal.virtuoso?.scrollIntoView({
                behavior: 'smooth',
                index: get().internal.currentIndex
            });
            delaySetNormal();
        },
        updateBoundary: (boundary: Ele) => {
            set({ boundary });
        },
        setVirtuoso: (virtuoso: VirtuosoHandle) => {
            get().internal.virtuoso = virtuoso;
        },
        updateVisibleRange: (range: [number, number]) => {
            set({ visibleRange: range });
        },
        pauseMeasurement: () => {
            const scrollState = get().scrollState;
            if (scrollState === 'PAUSE_MEASUREMENT') {
                return;
            }
            set({ scrollState: 'PAUSE_MEASUREMENT' });
            setTimeout(() => {
                set({ scrollState });
            }, 500);
        },
        delaySetNormal
    }))
);
export default useSubtitleScroll;
const scrollTask = () => {
    if (useSubtitleScroll.getState().scrollState === 'USER_BROWSING' || useSubtitleScroll.getState().scrollState === 'PAUSE_MEASUREMENT') {
        return;
    }
    const index = usePlayerController.getState().currentSentence?.index ?? 0;
    const visibleRange = useSubtitleScroll.getState().visibleRange;
    if (index < visibleRange[0] || index > visibleRange[1]) {
        useSubtitleScroll.setState({ scrollState: 'AUTO_SCROLLING' });
        useSubtitleScroll.getState().internal.virtuoso?.scrollToIndex({
            behavior: 'smooth',
            index
        });
        delaySetNormal();
    }
};

setInterval(scrollTask, 1000);
