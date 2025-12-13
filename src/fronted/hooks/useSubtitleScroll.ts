import { VirtuosoHandle } from 'react-virtuoso';
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { useStoreWithEqualityFn } from 'zustand/traditional';
import { Ele } from './useBoundary';
import useLayout from './useLayout';

export type ScrollState =
    | 'USER_BROWSING'
    | 'AUTO_SCROLLING'
    | 'NORMAL'
    | 'PAUSE_MEASUREMENT';
export type SubtitleScrollState = {
    internal: {
        virtuoso: VirtuosoHandle | null;
        currentIndex: number;
        currentRef: HTMLDivElement | null;
        scrollStatusTimer: number | undefined | NodeJS.Timeout;
        scrollTopTimer: number | undefined | NodeJS.Timeout;
        visibleRange: [number, number];
        syncPending: boolean;
        lastSyncIndex: number;
    };
    scrollState: ScrollState;
    boundary: Ele;
};
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

const inBoundary = (ref: HTMLDivElement) => {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    const index = useSubtitleScroll.getState().internal.currentIndex;
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    const { visibleRange } = useSubtitleScroll.getState().internal;
    if (index < visibleRange[0] || index > visibleRange[1]) {
        return false;
    }
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    const { boundary } = useSubtitleScroll.getState();
    const ele = getEle(ref);
    return ele.yt >= boundary.yt && ele.yb <= boundary.yb;
};

export type SubtitleScrollActions = {
    onScrolling: () => void;
    updateCurrentRef: (ref: HTMLDivElement | null, index: number) => void;
    syncCurrentIntoView: () => void;
    syncIndexIntoView: (index: number) => void;
    onUserFinishScrolling: () => void;
    setVirtuoso: (virtuoso: VirtuosoHandle) => void;
    updateBoundary: (boundary: Ele) => void;
    updateVisibleRange: (range: [number, number]) => void;
    pauseMeasurement: () => void;
    delaySetNormal: () => void;
};
const delaySetNormal = () => {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    const scrollTimer = useSubtitleScroll.getState().internal.scrollStatusTimer;
    if (scrollTimer) {
        clearTimeout(scrollTimer);
    }
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    useSubtitleScroll.getState().internal.scrollStatusTimer = setTimeout(() => {
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        useSubtitleScroll.setState({ scrollState: 'NORMAL' });
    }, 300);
};

const syncCurrentIntoView = () => {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    const { scrollState, boundary, internal } = useSubtitleScroll.getState();
    internal.syncPending = false;
    if (scrollState === 'USER_BROWSING' || scrollState === 'PAUSE_MEASUREMENT') {
        return;
    }
    const ref = internal.currentRef;
    const index = internal.currentIndex;
    const virtuoso = internal.virtuoso;
    if (!ref || !virtuoso || !boundary || index < 0) {
        return;
    }

    if (internal.lastSyncIndex === index) {
        return;
    }
    internal.lastSyncIndex = index;

    if (inBoundary(ref)) {
        return;
    }

    const { showSideBar } = useLayout.getState();
    if (showSideBar) {
        useSubtitleScroll.setState({ scrollState: 'AUTO_SCROLLING' });
        setTimeout(() => {
            virtuoso.scrollToIndex({ index, align: 'start' });
            delaySetNormal();
        }, 0);
        return;
    }

    const currentEle = getEle(ref);
    if (topShouldScroll(boundary, currentEle)) {
        useSubtitleScroll.setState({ scrollState: 'AUTO_SCROLLING' });
        setTimeout(() => {
            virtuoso.scrollToIndex({ index, align: 'start' });
            delaySetNormal();
        }, 0);
        return;
    }

    const scrollBottom = suggestScrollBottom(boundary, currentEle);
    if (scrollBottom <= 0) {
        return;
    }

    if (internal.scrollTopTimer) {
        clearTimeout(internal.scrollTopTimer);
    }
    useSubtitleScroll.setState({ scrollState: 'AUTO_SCROLLING' });
    setTimeout(() => {
        virtuoso.scrollBy({ top: scrollBottom });
    }, 0);
    internal.scrollTopTimer = setTimeout(() => {
        virtuoso.scrollToIndex({ behavior: 'smooth', index, align: 'start' });
        delaySetNormal();
    }, 150);
};

const useSubtitleScroll = create(
    subscribeWithSelector<SubtitleScrollState & SubtitleScrollActions>(
        (set, get) => ({
            internal: {
                virtuoso: null,
                currentIndex: -1,
                scrollStatusTimer: undefined,
                scrollTopTimer: undefined,
                currentRef: null,
                visibleRange: [0, 0],
                syncPending: false,
                lastSyncIndex: -1,
            },
            scrollState: 'NORMAL',
            boundary: {
                yt: 0,
                yb: 0,
            },
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
                const internal = get().internal;
                if (internal.currentIndex === index && internal.currentRef === ref) {
                    return;
                }
                internal.currentIndex = index;
                internal.currentRef = ref;

                if (!ref || get().scrollState === 'USER_BROWSING' || get().scrollState === 'PAUSE_MEASUREMENT') {
                    return;
                }
                if (internal.syncPending) {
                    return;
                }
                internal.syncPending = true;
                setTimeout(() => {
                    syncCurrentIntoView();
                }, 0);
            },
            syncCurrentIntoView,
            syncIndexIntoView: (index: number) => {
                const { scrollState, internal } = get();
                if (scrollState === 'USER_BROWSING' || scrollState === 'PAUSE_MEASUREMENT') {
                    return;
                }
                if (!internal.virtuoso || index < 0) {
                    return;
                }
                internal.currentIndex = index;

                const { visibleRange } = internal;
                if (index >= visibleRange[0] && index <= visibleRange[1]) {
                    return;
                }
                set({ scrollState: 'AUTO_SCROLLING' });
                internal.virtuoso.scrollToIndex({ behavior: 'smooth', index, align: 'start' });
                delaySetNormal();
            },
            onUserFinishScrolling: () => {
                set({ scrollState: 'AUTO_SCROLLING' });
                get().internal.virtuoso?.scrollToIndex({
                    behavior: 'smooth',
                    index: get().internal.currentIndex,
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
                const current = get().internal.visibleRange;
                if (current[0] === range[0] && current[1] === range[1]) {
                    return;
                }
                get().internal.visibleRange = range;
            },
            pauseMeasurement: () => {
                const { scrollState } = get();
                if (scrollState === 'PAUSE_MEASUREMENT') {
                    return;
                }
                set({ scrollState: 'PAUSE_MEASUREMENT' });
                setTimeout(() => {
                    set({ scrollState });
                    if (!useLayout.getState().showSideBar) {
                        useSubtitleScroll.getState().onScrolling();
                    }
                }, 500);
            },
            delaySetNormal,
        })
    )
);
export default useSubtitleScroll;

export function useSubtitleScrollState<T>(
    selector: (s: SubtitleScrollState & SubtitleScrollActions) => T,
    equalityFn?: (a: T, b: T) => boolean
): T {
    return useStoreWithEqualityFn(useSubtitleScroll, selector, equalityFn);
}
