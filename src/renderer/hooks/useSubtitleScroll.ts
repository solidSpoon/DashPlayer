import { VirtuosoHandle } from 'react-virtuoso';
import { Ele } from './useBoundary';
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import useLayout from './useLayout';

export type ScrollState = 'USER_BROWSING' | 'AUTO_SCROLLING' | 'NORMAL';
export type SubtitleScrollState = {
    internal: {
        virtuoso: VirtuosoHandle | null;
        currentIndex: number;
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
export type SubtitleScrollActions = {
    onScrolling: () => void;
    updateCurrentRef: (ref: HTMLDivElement | null, index: number) => void;
    onUserFinishScrolling: () => void;
    setVirtuoso: (virtuoso: VirtuosoHandle) => void;
    updateBoundary: (boundary: Ele) => void;
    updateVisibleRange: (range: [number, number]) => void;
}

const useSubtitleScroll = create(
    subscribeWithSelector<SubtitleScrollState & SubtitleScrollActions>((set, get) => ({
        internal: {
            virtuoso: null,
            currentIndex: -1,
            scrollStatusTimer: undefined,
            scrollTopTimer: undefined
        },
        scrollState: 'NORMAL',
        boundary: {
            yt: 0,
            yb: 0
        },
        visibleRange: [0, 0],
        onScrolling: () => {
            const cs = get().scrollState;
            if (cs === 'NORMAL' || cs === 'USER_BROWSING') {
                set({ scrollState: 'USER_BROWSING' });
                return;
            }
            const scrollTimer = get().internal.scrollStatusTimer;
            if (scrollTimer) {
                clearTimeout(scrollTimer);
            }
            get().internal.scrollStatusTimer = setTimeout(() => {
                set({ scrollState: 'NORMAL' });
            }, 200);
        },
        updateCurrentRef: (ref: HTMLDivElement | null, index: number) => {
            const lastIndex = get().internal.currentIndex;
            get().internal.currentIndex = index;
            if (!ref || !get().boundary) {
                return;
            }
            if (lastIndex === index) {
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
                    get().internal.scrollTopTimer = setTimeout(({indx}) => {
                        console.log('scroll to index', indx);
                        set({ scrollState: 'AUTO_SCROLLING' });
                        get().internal.virtuoso?.scrollToIndex({
                            behavior: 'smooth',
                            index:indx
                        });
                    }, 150,{indx: index});
                }
            }
        },
        onUserFinishScrolling: () => {
            set({ scrollState: 'AUTO_SCROLLING' });
            get().internal.virtuoso?.scrollToIndex({
                behavior: 'smooth',
                index: get().internal.currentIndex
            });
        },
        updateBoundary: (boundary: Ele) => {
            set({ boundary });
        },
        setVirtuoso: (virtuoso: VirtuosoHandle) => {
            get().internal.virtuoso = virtuoso;
        },
        updateVisibleRange: (range: [number, number]) => {
            set({ visibleRange: range });
        }
    }))
);
export default useSubtitleScroll;
const scrollTask = () => {
    if (useSubtitleScroll.getState().scrollState === 'USER_BROWSING') {
        return;
    }
    const index = useSubtitleScroll.getState().internal.currentIndex;
    const visibleRange = useSubtitleScroll.getState().visibleRange;
    if (index < visibleRange[0] || index > visibleRange[1]) {
        useSubtitleScroll.getState().internal.virtuoso?.scrollToIndex({
            behavior: 'smooth',
            index
        });
    }
}

setTimeout(scrollTask, 1000);
