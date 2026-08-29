/**
 * 管理字幕自动滚动状态、可视边界和当前高亮项的滚动同步。
 */
import { VirtuosoHandle } from 'react-virtuoso';
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { useStoreWithEqualityFn } from 'zustand/traditional';
import { Ele } from './useBoundary';

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
        /** 用户通过滚轮中断了自动滚动，下一次 onScroll 应跳过状态判断 */
        interrupted: boolean;
    };
    scrollState: ScrollState;
    boundary: Ele;
};
const suggestScrollBottom = (boundary: Ele, e: Ele): number => {
    if (e.yb > boundary.yb) {
        return e.yb - boundary.yb;
    }
    return 0;
};

const topShouldScroll = (boundary: Ele, e: Ele): boolean => {
    return e.yt < boundary.yt;
};

const bottomShouldScroll = (boundary: Ele, e: Ele): boolean => {
    return e.yb > boundary.yb;
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
    /** 用户通过滚轮中断自动滚动时调用，立即切换到浏览模式 */
    onUserInterrupt: () => void;
};

const cancelPendingTimers = () => {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    const internal = useSubtitleScroll.getState().internal;
    if (internal.scrollStatusTimer) {
        clearTimeout(internal.scrollStatusTimer);
        internal.scrollStatusTimer = undefined;
    }
    if (internal.scrollTopTimer) {
        clearTimeout(internal.scrollTopTimer);
        internal.scrollTopTimer = undefined;
    }
};

const delaySetNormal = (delay = 300) => {
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    const internal = useSubtitleScroll.getState().internal;
    if (internal.scrollStatusTimer) {
        clearTimeout(internal.scrollStatusTimer);
    }
    internal.scrollStatusTimer = setTimeout(() => {
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        useSubtitleScroll.setState({ scrollState: 'NORMAL' });
    }, delay);
};

const executeScroll = (
    virtuoso: VirtuosoHandle,
    index: number,
    options?: { align?: 'start' | 'center' | 'end'; smooth?: boolean }
) => {
    cancelPendingTimers();
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    useSubtitleScroll.setState({ scrollState: 'AUTO_SCROLLING' });
    virtuoso.scrollToIndex({
        index,
        align: options?.align,
        behavior: options?.smooth ? 'smooth' : 'auto',
    });
    delaySetNormal();
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

    const currentEle = getEle(ref);
    if (topShouldScroll(boundary, currentEle)) {
        // 场景一：向上越出上边界，立即定位到顶部，快速切句零延迟
        executeScroll(virtuoso, index, { align: 'start', smooth: false });
    } else if (bottomShouldScroll(boundary, currentEle)) {
        // 场景二：下边界触碰
        // 第一步：先立即以最小距离微滚展现出来（即刻跟手响应）
        const scrollBottom = suggestScrollBottom(boundary, currentEle);
        cancelPendingTimers();
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        useSubtitleScroll.setState({ scrollState: 'AUTO_SCROLLING' });
        if (scrollBottom > 0) {
            virtuoso.scrollBy({ top: scrollBottom });
        } else {
            virtuoso.scrollToIndex({ index, align: 'end', behavior: 'auto' });
        }

        // 第二步：等待用户按键操作停歇后（防抖 250ms），再平滑将该行滚动到顶部
        internal.scrollTopTimer = setTimeout(() => {
            // eslint-disable-next-line @typescript-eslint/no-use-before-define
            const currentScrollState = useSubtitleScroll.getState().scrollState;
            if (currentScrollState === 'USER_BROWSING' || currentScrollState === 'PAUSE_MEASUREMENT') {
                return;
            }
            // eslint-disable-next-line @typescript-eslint/no-use-before-define
            useSubtitleScroll.setState({ scrollState: 'AUTO_SCROLLING' });
            virtuoso.scrollToIndex({
                index,
                align: 'start',
                behavior: 'smooth',
            });
            delaySetNormal(500);
        }, 250);
    }
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
                interrupted: false,
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
                // 用户滚轮中断后，跳过一次 onScroll 防止 auto-scroll 动画残余触发误切换
                if (get().internal.interrupted) {
                    get().internal.interrupted = false;
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
                // 如果当前已在可视范围内，无需打断视口
                if (index >= visibleRange[0] && index <= visibleRange[1]) {
                    return;
                }
                // 按键跨出可视区快速导航：立即定位以保证连击跟手
                executeScroll(internal.virtuoso, index, { smooth: false });
            },
            onUserFinishScrolling: () => {
                const virtuoso = get().internal.virtuoso;
                const index = get().internal.currentIndex;
                if (virtuoso && index >= 0) {
                    // 用户点击悬浮按钮返回当前播放位置：平滑回到当前句
                    executeScroll(virtuoso, index, { smooth: true });
                }
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
                    useSubtitleScroll.getState().onScrolling();
                }, 500);
            },
            delaySetNormal,
            onUserInterrupt: () => {
                const { scrollState, internal } = get();
                if (scrollState !== 'AUTO_SCROLLING') {
                    return;
                }
                internal.interrupted = true;
                cancelPendingTimers();
                set({ scrollState: 'USER_BROWSING' });
            },
        })
    )
);
export default useSubtitleScroll;

const subtitleScrollStore = useSubtitleScroll;

export function useSubtitleScrollState<T>(
    selector: (s: SubtitleScrollState & SubtitleScrollActions) => T,
    equalityFn?: (a: T, b: T) => boolean
): T {
    return useStoreWithEqualityFn(subtitleScrollStore, selector, equalityFn);
}

