/**
 * 管理字幕自动滚动状态、可视边界和当前高亮项的滚动同步。
 */
import { VirtuosoHandle } from 'react-virtuoso';
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { useStoreWithEqualityFn } from 'zustand/traditional';
import { Ele } from './useBoundary';
import useLayout from '@/fronted/hooks/useLayout';

export type ScrollState =

    | 'USER_BROWSING'
    | 'AUTO_SCROLLING'
    | 'NORMAL'
    | 'PAUSE_MEASUREMENT';
export type SubtitleScrollState = {
    internal: {
        virtuoso: VirtuosoHandle | null;
        /** 当前高亮项在 Virtuoso 列表中的实际数组位置下标（0 ~ sentences.length - 1） */
        currentListPosition: number;
        currentRef: HTMLDivElement | null;
        scrollStatusTimer: number | undefined | NodeJS.Timeout;
        scrollTopTimer: number | undefined | NodeJS.Timeout;
        /** 当前 Virtuoso 视口渲染的列表位置范围 [startListPos, endListPos] */
        visibleRange: [number, number];
        syncPending: boolean;
        lastSyncListPosition: number;
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
    const listPosition = useSubtitleScroll.getState().internal.currentListPosition;
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    const { visibleRange } = useSubtitleScroll.getState().internal;
    if (listPosition < visibleRange[0] || listPosition > visibleRange[1]) {
        return false;
    }
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    const { boundary } = useSubtitleScroll.getState();
    const ele = getEle(ref);
    return ele.yt >= boundary.yt && ele.yb <= boundary.yb;
};

export type SubtitleScrollActions = {
    onScrolling: () => void;
    updateCurrentRef: (ref: HTMLDivElement | null, listPosition: number) => void;
    syncCurrentIntoView: () => void;
    syncListPositionIntoView: (listPosition: number) => void;
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
    listPosition: number,
    options?: { align?: 'start' | 'center' | 'end'; smooth?: boolean }
) => {
    cancelPendingTimers();
    // eslint-disable-next-line @typescript-eslint/no-use-before-define
    useSubtitleScroll.setState({ scrollState: 'AUTO_SCROLLING' });
    virtuoso.scrollToIndex({
        index: listPosition,
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
    const listPosition = internal.currentListPosition;
    const virtuoso = internal.virtuoso;
    if (!ref || !virtuoso || !boundary || listPosition < 0) {
        return;
    }

    const lastListPos = internal.lastSyncListPosition;
    if (lastListPos === listPosition) {
        return;
    }
    internal.lastSyncListPosition = listPosition;

    if (inBoundary(ref)) {
        return;
    }

    const { showSideBar } = useLayout.getState();
    if (showSideBar) {
        // 小窗模式下保持极简滚动：不做复杂的两阶段或边界换算，直接通过 Virtuoso 原生对齐确保当前句在可视区内
        executeScroll(virtuoso, listPosition, { align: 'start', smooth: false });
        return;
    }


    const currentEle = getEle(ref);
    const isMovingUp = lastListPos >= 0 && listPosition < lastListPos;

    // 只要是向上切句或者越出上边界：严格对齐到顶部（align: 'start'），绝不贴到底部
    if (isMovingUp || topShouldScroll(boundary, currentEle)) {
        executeScroll(virtuoso, listPosition, { align: 'start', smooth: false });
        return;
    }

    if (bottomShouldScroll(boundary, currentEle)) {
        // 向下播放/切句触碰下边界：
        // 第一步：先立即以最小距离微滚展现出来（即刻跟手响应）
        const scrollBottom = suggestScrollBottom(boundary, currentEle);
        cancelPendingTimers();
        // eslint-disable-next-line @typescript-eslint/no-use-before-define
        useSubtitleScroll.setState({ scrollState: 'AUTO_SCROLLING' });
        if (scrollBottom > 0) {
            virtuoso.scrollBy({ top: scrollBottom });
        } else {
            virtuoso.scrollToIndex({ index: listPosition, align: 'end', behavior: 'auto' });
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
                index: listPosition,
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
                currentListPosition: -1,
                scrollStatusTimer: undefined,
                scrollTopTimer: undefined,
                currentRef: null,
                visibleRange: [0, 0],
                syncPending: false,
                lastSyncListPosition: -1,
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
                    // 只有当前句重新回到安全边界内时，才恢复 NORMAL 状态
                    if (ref && inBoundary(ref)) {
                        delaySetNormal(150);
                    }
                    return;
                }
                if (cs === 'NORMAL') {
                    const ref = get().internal.currentRef;
                    if (ref && !inBoundary(ref)) {
                        cancelPendingTimers();
                        set({ scrollState: 'USER_BROWSING' });
                    }
                    return;
                }
                delaySetNormal();
            },
            updateCurrentRef: (ref: HTMLDivElement | null, listPosition: number) => {
                const internal = get().internal;
                if (internal.currentListPosition === listPosition && internal.currentRef === ref) {
                    return;
                }
                internal.currentListPosition = listPosition;
                internal.currentRef = ref;

                const currentScrollState = get().scrollState;

                // 若处于用户浏览状态，但视频自然播放推进使新的当前句进入了屏幕可视安全区，自动恢复 NORMAL 让返回按钮消失
                if (currentScrollState === 'USER_BROWSING') {
                    if (ref && inBoundary(ref)) {
                        delaySetNormal(150);
                    }
                    return;
                }

                if (!ref || currentScrollState === 'PAUSE_MEASUREMENT') {
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
            syncListPositionIntoView: (listPosition: number) => {
                const { scrollState, internal } = get();
                if (scrollState === 'USER_BROWSING' || scrollState === 'PAUSE_MEASUREMENT') {
                    return;
                }
                if (!internal.virtuoso || listPosition < 0) {
                    return;
                }
                const lastListPos = internal.currentListPosition;
                internal.currentListPosition = listPosition;

                const { visibleRange } = internal;
                // 如果当前已在可视范围内，无需打断视口
                if (listPosition >= visibleRange[0] && listPosition <= visibleRange[1]) {
                    return;
                }
                // 按键跨出可视区快速导航：向上导航严格 align: 'start' 对齐到顶部
                const isMovingUp = listPosition < visibleRange[0] || (lastListPos >= 0 && listPosition < lastListPos);
                executeScroll(internal.virtuoso, listPosition, {
                    align: isMovingUp ? 'start' : 'end',
                    smooth: false,
                });
            },

            onUserFinishScrolling: () => {
                const virtuoso = get().internal.virtuoso;
                const listPosition = get().internal.currentListPosition;
                if (virtuoso && listPosition >= 0) {
                    // 用户点击悬浮按钮返回当前播放位置：平滑回到当前句
                    executeScroll(virtuoso, listPosition, { smooth: true });
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

                if (get().scrollState === 'USER_BROWSING') {
                    const ref = get().internal.currentRef;
                    if (ref && inBoundary(ref)) {
                        delaySetNormal(150);
                    }
                }
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

