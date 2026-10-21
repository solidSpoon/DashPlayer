/**
 * 管理字幕自动滚动状态、可视边界和当前高亮项的滚动同步。
 *
 * 第一性原理：用平滑动画把当前句展示在可视窗口内。
 * 所有瞬移（behavior: 'auto'）都是特例——连按切句时动画跟不上节奏，
 * 需要即刻把当前行钉在边界上，等切句停歇后再平滑归位到顶部。
 */
import { VirtuosoHandle } from 'react-virtuoso';
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { useStoreWithEqualityFn } from 'zustand/traditional';
import { Ele } from './useBoundary';
import useLayout from '@/fronted/hooks/useLayout';

export type ScrollState =
    /** 用户正在浏览，自动滚动完全让位 */
    | 'USER_BROWSING'
    /** 自动滚动执行中（瞬跳或平滑） */
    | 'AUTO_SCROLLING'
    /** 跟读待命，当前句变化时执行滚动编排 */
    | 'NORMAL'
    /** 卡片/全屏模式切换期间界面跳变，冻结一切判定 */
    | 'PAUSE_MEASUREMENT';

/** 滚动状态机的定时常量（毫秒） */
const TIMING = {
    /** 用户浏览态下，当前句回到边界内后恢复跟读的延时 */
    RESUME_NORMAL: 150,
    /** 自动滚动结束后回归 NORMAL 的沉降延时 */
    AUTO_SETTLE: 300,
    /** 底部两阶段编排：等待切句停歇的防抖时长 */
    PIN_DEBOUNCE: 250,
    /** 第二阶段平滑归顶后的沉降延时 */
    TOP_SETTLE: 500,
    /** 模式切换期间冻结测量的时长 */
    PAUSE_MEASUREMENT: 500,
};

export type SubtitleScrollState = {
    internal: {
        virtuoso: VirtuosoHandle | null;
        /** 当前句在 Virtuoso 列表中的数组下标（0 ~ sentences.length - 1），与 DOM 无关 */
        currentListPosition: number;
        /** currentRef 指向的行的列表下标；与 currentListPosition 不一致说明目标行尚未渲染 */
        currentRefPosition: number;
        currentRef: HTMLDivElement | null;
        scrollStatusTimer: number | undefined | NodeJS.Timeout;
        scrollTopTimer: number | undefined | NodeJS.Timeout;
        /** Virtuoso 当前渲染的列表范围 [start, end]（含视口外 overscan 缓冲） */
        visibleRange: [number, number];
        /**
         * 上一次因 ref 未刷新而延迟同步的位置。
         * 同一位置只延迟一拍：延迟后 ref 仍未就绪说明目标行真未渲染，按远距离跳转处理。
         */
        deferredPosition: number;
        /** 上一次完成同步时的列表位置；用于判断本次切句方向（向上/向下） */
        lastSyncedPosition: number;
        /** 已有待执行的同步调度标记，防止重复堆叠 */
        syncPending: boolean;
        /** 用户通过输入中断了自动滚动，下一次 onScroll 应跳过状态判断 */
        interrupted: boolean;
    };
    scrollState: ScrollState;
    /** 字幕容器可视安全边界；组件挂载、useBoundary 测量完成前为 null */
    boundary: Ele | null;
};

export type SubtitleScrollActions = {
    onScrolling: () => void;
    updateCurrentRef: (ref: HTMLDivElement | null, listPosition: number) => void;
    /** 统一的同步入口：确保当前句位于可视边界内（第一性原理的实现） */
    syncIntoView: (listPosition: number) => void;
    onUserFinishScrolling: () => void;
    setVirtuoso: (virtuoso: VirtuosoHandle) => void;
    updateBoundary: (boundary: Ele) => void;
    updateVisibleRange: (range: [number, number]) => void;
    pauseMeasurement: () => void;
    delaySetNormal: () => void;
    /** 用户输入（滚轮/滚动条/翻页键）中断自动滚动时调用，立即切换到浏览模式 */
    onUserInterrupt: () => void;
};

const getEle = (ele: HTMLDivElement): Ele => {
    const rect = ele.getBoundingClientRect();
    return {
        yt: rect.top,
        yb: rect.bottom,
    };
};

const useSubtitleScroll = create(
    subscribeWithSelector<SubtitleScrollState & SubtitleScrollActions>(
        (set, get) => {
            /** 取消所有挂起的状态/滚动定时器 */
            const cancelPendingTimers = () => {
                const internal = get().internal;
                if (internal.scrollStatusTimer) {
                    clearTimeout(internal.scrollStatusTimer);
                    internal.scrollStatusTimer = undefined;
                }
                if (internal.scrollTopTimer) {
                    clearTimeout(internal.scrollTopTimer);
                    internal.scrollTopTimer = undefined;
                }
            };

            /** 延迟回归 NORMAL；自动滚动期间的每次 scroll 事件都会重置该计时 */
            const delaySetNormal = (delay = TIMING.AUTO_SETTLE) => {
                const internal = get().internal;
                if (internal.scrollStatusTimer) {
                    clearTimeout(internal.scrollStatusTimer);
                }
                internal.scrollStatusTimer = setTimeout(() => {
                    set({ scrollState: 'NORMAL' });
                }, delay);
            };

            /**
             * 执行一次自动滚动并进入 AUTO_SCROLLING。
             * 瞬移（smooth: false）仅用于连按切句时把当前行钉在边界，其余场景应传 smooth。
             */
            const executeScroll = (
                virtuoso: VirtuosoHandle,
                listPosition: number,
                options?: { align?: 'start' | 'center' | 'end'; smooth?: boolean }
            ) => {
                cancelPendingTimers();
                set({ scrollState: 'AUTO_SCROLLING' });
                virtuoso.scrollToIndex({
                    index: listPosition,
                    align: options?.align,
                    behavior: options?.smooth ? 'smooth' : 'auto',
                });
                delaySetNormal();
            };

            /**
             * 判断 currentRef 指向的行是否已在可视安全边界内。
             * 行不在渲染范围（含游离的旧 DOM 节点）或边界未就绪时一律视为不可见。
             */
            const inBoundary = () => {
                const { boundary, internal } = get();
                if (!boundary || !internal.currentRef) {
                    return false;
                }
                const pos = internal.currentRefPosition;
                if (pos < internal.visibleRange[0] || pos > internal.visibleRange[1]) {
                    return false;
                }
                const ele = getEle(internal.currentRef);
                return ele.yt >= boundary.yt && ele.yb <= boundary.yb;
            };

            /**
             * 调度一次异步同步；syncPending 防止重复堆叠。
             * 回调始终同步到最新的目标位置，切句连发时过期目标自然被新目标覆盖。
             */
            const scheduleSync = () => {
                const internal = get().internal;
                if (internal.syncPending) {
                    return;
                }
                internal.syncPending = true;
                setTimeout(() => {
                    get().syncIntoView(get().internal.currentListPosition);
                }, 0);
            };

            return {
                internal: {
                    virtuoso: null,
                    currentListPosition: -1,
                    currentRefPosition: -1,
                    scrollStatusTimer: undefined,
                    scrollTopTimer: undefined,
                    currentRef: null,
                    visibleRange: [0, 0],
                    deferredPosition: -1,
                    lastSyncedPosition: -1,
                    syncPending: false,
                    interrupted: false,
                },
                scrollState: 'NORMAL',
                boundary: null,
                onScrolling: () => {
                    const cs = get().scrollState;
                    if (cs === 'PAUSE_MEASUREMENT') {
                        return;
                    }
                    // 用户输入中断后，跳过一拍 scroll 事件，防止自动滚动动画残余触发误切换
                    if (get().internal.interrupted) {
                        get().internal.interrupted = false;
                        return;
                    }
                    if (cs === 'USER_BROWSING') {
                        // 只有当前句重新回到安全边界内时，才恢复 NORMAL 状态
                        if (inBoundary()) {
                            delaySetNormal(TIMING.RESUME_NORMAL);
                        }
                        return;
                    }
                    if (cs === 'NORMAL') {
                        // 边界未就绪时不做越界判定，避免启动期误判为浏览态
                        if (!get().boundary) {
                            return;
                        }
                        if (get().internal.currentRef && !inBoundary()) {
                            cancelPendingTimers();
                            set({ scrollState: 'USER_BROWSING' });
                        }
                        return;
                    }
                    delaySetNormal();
                },
                updateCurrentRef: (ref: HTMLDivElement | null, listPosition: number) => {
                    const internal = get().internal;
                    if (internal.currentRefPosition === listPosition && internal.currentRef === ref) {
                        return;
                    }
                    internal.currentRef = ref;
                    internal.currentRefPosition = listPosition;
                    internal.currentListPosition = listPosition;

                    const currentScrollState = get().scrollState;

                    // 浏览态下若播放自然推进使新的当前句进入边界，自动恢复跟读
                    if (currentScrollState === 'USER_BROWSING') {
                        if (ref && inBoundary()) {
                            delaySetNormal(TIMING.RESUME_NORMAL);
                        }
                        return;
                    }

                    if (!ref || currentScrollState === 'PAUSE_MEASUREMENT') {
                        return;
                    }
                    scheduleSync();
                },
                /**
                 * 统一同步入口：把当前句送回可视边界内。
                 * - 目标行 ref 未刷新但仍在渲染范围内：等一拍（Virtuoso 行重渲染滞后于
                 *   effect 执行），ref 刷新后再实测判定，避免把正常切句误判为远跳
                 * - 目标行未渲染（远距离跳转）：按方向直接 scrollToIndex 对齐
                 * - 目标行已渲染且在边界内：不动
                 * - 向上切句或越出上边界：瞬跳对齐顶部
                 * - 越出下边界：两阶段——先瞬移钉在下边界，停歇后平滑归顶
                 */
                syncIntoView: (listPosition: number) => {
                    const { scrollState, boundary, internal } = get();
                    internal.syncPending = false;
                    if (scrollState === 'USER_BROWSING' || scrollState === 'PAUSE_MEASUREMENT') {
                        return;
                    }
                    const { virtuoso } = internal;
                    if (!virtuoso || !boundary || listPosition < 0) {
                        return;
                    }

                    const ref = internal.currentRef;
                    if (!ref || internal.currentRefPosition !== listPosition) {
                        // 目标行仍在渲染范围内：ref 回调只是晚于 effect 一拍，此时远跳会
                        // 把行瞬移到底部再触发两阶段归顶（实测坐标必越界），必须等 ref
                        // 刷新后实测再判定；同一位置只等一拍，防止死循环
                        const inRange =
                            listPosition >= internal.visibleRange[0] &&
                            listPosition <= internal.visibleRange[1];
                        if (inRange && internal.deferredPosition !== listPosition) {
                            internal.currentListPosition = listPosition;
                            internal.deferredPosition = listPosition;
                            scheduleSync();
                            return;
                        }
                        // 切句方向基于"上一次完成同步的位置"判断
                        const movingUp =
                            internal.lastSyncedPosition >= 0 &&
                            listPosition < internal.lastSyncedPosition;
                        internal.lastSyncedPosition = listPosition;
                        internal.currentListPosition = listPosition;
                        internal.deferredPosition = -1;
                        executeScroll(virtuoso, listPosition, { align: movingUp ? 'start' : 'end' });
                        return;
                    }

                    // 切句方向基于"上一次完成同步的位置"判断：currentListPosition 在
                    // updateCurrentRef 调度前就已被写为目标值，不能用它判向
                    const movingUp =
                        internal.lastSyncedPosition >= 0 &&
                        listPosition < internal.lastSyncedPosition;
                    internal.lastSyncedPosition = listPosition;
                    internal.currentListPosition = listPosition;
                    internal.deferredPosition = -1;

                    const ele = getEle(ref);
                    if (ele.yt >= boundary.yt && ele.yb <= boundary.yb) {
                        return;
                    }

                    // 向上切句或越出上边界：瞬跳严格对齐顶部，绝不贴底
                    if (movingUp || ele.yt < boundary.yt) {
                        executeScroll(virtuoso, listPosition, { align: 'start' });
                        return;
                    }

                    // 越出下边界，两阶段编排：
                    // 第一阶段：立即以最小距离瞬移，把当前行钉在下边界（连按切句不跳变）
                    cancelPendingTimers();
                    set({ scrollState: 'AUTO_SCROLLING' });
                    const { showSideBar } = useLayout.getState();
                    if (showSideBar) {
                        // 小窗容器被 CSS transform 缩放，scrollBy 的布局像素与视觉坐标不一致，
                        // 改用 Virtuoso 原生对齐规避缩放换算
                        virtuoso.scrollToIndex({ index: listPosition, align: 'end', behavior: 'auto' });
                    } else {
                        virtuoso.scrollBy({ top: ele.yb - boundary.yb });
                    }

                    // 第二阶段：切句停歇后，平滑把当前行滚动到顶部
                    internal.scrollTopTimer = setTimeout(() => {
                        const cs = get().scrollState;
                        if (cs === 'USER_BROWSING' || cs === 'PAUSE_MEASUREMENT') {
                            return;
                        }
                        set({ scrollState: 'AUTO_SCROLLING' });
                        virtuoso.scrollToIndex({
                            index: listPosition,
                            align: 'start',
                            behavior: 'smooth',
                        });
                        delaySetNormal(TIMING.TOP_SETTLE);
                    }, TIMING.PIN_DEBOUNCE);
                },
                onUserFinishScrolling: () => {
                    const { virtuoso, currentListPosition } = get().internal;
                    if (virtuoso && currentListPosition >= 0) {
                        // 悬浮按钮/快捷键返回当前播放位置：平滑回到当前句
                        executeScroll(virtuoso, currentListPosition, { smooth: true });
                    }
                },
                /**
                 * 更新可视安全边界。
                 * 边界变化（分栏拖动、窗口缩放、全屏切换）可能把当前行挤出屏幕，
                 * NORMAL 态下重新调度一次同步，把当前行拉回边界内。
                 */
                updateBoundary: (boundary: Ele) => {
                    set({ boundary });
                    const { scrollState } = get();
                    if (scrollState !== 'NORMAL') {
                        return;
                    }
                    scheduleSync();
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

                    if (get().scrollState === 'USER_BROWSING' && inBoundary()) {
                        delaySetNormal(TIMING.RESUME_NORMAL);
                    }
                },
                /**
                 * 卡片/全屏模式切换期间暂停滚动测量，避免界面跳变过程中的边界抖动误触发状态切换。
                 * 恢复前校验状态仍为 PAUSE_MEASUREMENT：暂停期间用户若主动滚动进入浏览态，
                 * 则放弃恢复快照，避免覆盖用户意图导致自动滚动复活。
                 */
                pauseMeasurement: () => {
                    const { scrollState } = get();
                    if (scrollState === 'PAUSE_MEASUREMENT') {
                        return;
                    }
                    set({ scrollState: 'PAUSE_MEASUREMENT' });
                    setTimeout(() => {
                        if (get().scrollState !== 'PAUSE_MEASUREMENT') {
                            return;
                        }
                        set({ scrollState });
                        get().onScrolling();
                    }, TIMING.PAUSE_MEASUREMENT);
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
            };
        }
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
