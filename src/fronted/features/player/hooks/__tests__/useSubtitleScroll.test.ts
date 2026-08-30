import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { VirtuosoHandle } from 'react-virtuoso';
import useSubtitleScroll from '../useSubtitleScroll';
import useLayout from '@/fronted/hooks/useLayout';

/** 构造 rect 固定的 mock 字幕行 */
const mockRow = (top: number, bottom: number) =>
    ({
        getBoundingClientRect: () => ({ top, bottom }),
    }) as unknown as HTMLDivElement;

/** 构造带 spy 的 mock Virtuoso 实例 */
const mockVirtuoso = () => {
    const scrollToIndex = vi.fn();
    const scrollBy = vi.fn();
    return {
        scrollToIndex,
        scrollBy,
        handle: { scrollToIndex, scrollBy } as unknown as VirtuosoHandle,
    };
};

/** 重置滚动状态机到干净的 NORMAL 态 */
const resetStore = () => {
    useSubtitleScroll.setState({
        scrollState: 'NORMAL',
        boundary: { yt: 50, yb: 500 },
        internal: {
            virtuoso: null,
            currentListPosition: -1,
            currentRefPosition: -1,
            scrollStatusTimer: undefined,
            scrollTopTimer: undefined,
            currentRef: null,
            visibleRange: [0, 10],
            deferredPosition: -1,
            lastSyncedPosition: -1,
            syncPending: false,
            interrupted: false,
        },
    });
};

describe('useSubtitleScroll', () => {
    beforeEach(() => {
        vi.useFakeTimers();
        resetStore();
        useLayout.setState({ showSideBar: false });
    });

    afterEach(() => {
        vi.clearAllTimers();
        vi.useRealTimers();
    });

    it('用户滚动导致当前句越界时，进入浏览态停止自动跟读', () => {
        useSubtitleScroll.setState({
            internal: {
                ...useSubtitleScroll.getState().internal,
                currentRefPosition: 2,
                currentRef: mockRow(20, 45), // 顶部越界（安全上界 50）
            },
        });

        useSubtitleScroll.getState().onScrolling();

        expect(useSubtitleScroll.getState().scrollState).toBe('USER_BROWSING');
    });

    it('浏览态下当前句回到安全边界内时，恢复跟读', () => {
        useSubtitleScroll.setState({
            scrollState: 'USER_BROWSING',
            internal: {
                ...useSubtitleScroll.getState().internal,
                currentRefPosition: 2,
                currentRef: mockRow(100, 140),
            },
        });

        useSubtitleScroll.getState().onScrolling();
        vi.advanceTimersByTime(200);

        expect(useSubtitleScroll.getState().scrollState).toBe('NORMAL');
    });

    it('自动滚动期间收到用户输入时立即中断进入浏览态，并跳过一拍滚动事件', () => {
        useSubtitleScroll.setState({ scrollState: 'AUTO_SCROLLING' });

        useSubtitleScroll.getState().onUserInterrupt();

        expect(useSubtitleScroll.getState().scrollState).toBe('USER_BROWSING');
        expect(useSubtitleScroll.getState().internal.interrupted).toBe(true);

        // 中断后动画残余的第一个 scroll 事件应被吞掉，不触发状态翻转
        useSubtitleScroll.getState().onScrolling();
        expect(useSubtitleScroll.getState().internal.interrupted).toBe(false);
        expect(useSubtitleScroll.getState().scrollState).toBe('USER_BROWSING');
    });

    it('目标行尚未渲染的远距离向下跳转，直接按 end 对齐', () => {
        const virtuoso = mockVirtuoso();
        useSubtitleScroll.setState({
            internal: {
                ...useSubtitleScroll.getState().internal,
                virtuoso: virtuoso.handle,
                visibleRange: [0, 4], // 目标行 8 在渲染范围外
                currentListPosition: 2,
                currentRefPosition: 2,
                currentRef: mockRow(100, 140),
                lastSyncedPosition: 2,
            },
        });

        useSubtitleScroll.getState().syncIntoView(8);

        expect(virtuoso.scrollToIndex).toHaveBeenCalledWith(
            expect.objectContaining({ index: 8, align: 'end' })
        );
        expect(virtuoso.scrollBy).not.toHaveBeenCalled();
    });

    it('远距离向上切句时按 start 对齐到顶部', () => {
        const virtuoso = mockVirtuoso();
        useSubtitleScroll.setState({
            internal: {
                ...useSubtitleScroll.getState().internal,
                virtuoso: virtuoso.handle,
                visibleRange: [6, 10], // 目标行 3 在渲染范围外
                currentListPosition: 8,
                currentRefPosition: 8,
                currentRef: mockRow(100, 140),
                lastSyncedPosition: 8,
            },
        });

        useSubtitleScroll.getState().syncIntoView(3);

        expect(virtuoso.scrollToIndex).toHaveBeenCalledWith(
            expect.objectContaining({ index: 3, align: 'start' })
        );
    });

    it('切句后 ref 晚于 effect 一拍时先等待，ref 刷新后按实测位置判定而不远跳', () => {
        const virtuoso = mockVirtuoso();
        // 当前句 5 在边界内，切到相邻的 6：effect 先触发，ref 仍指向旧行
        useSubtitleScroll.setState({
            internal: {
                ...useSubtitleScroll.getState().internal,
                virtuoso: virtuoso.handle,
                currentListPosition: 5,
                currentRefPosition: 5,
                currentRef: mockRow(100, 140),
                lastSyncedPosition: 5,
            },
        });

        useSubtitleScroll.getState().syncIntoView(6);

        // 行 6 在渲染范围内：只登记延迟，不做远跳
        expect(virtuoso.scrollToIndex).not.toHaveBeenCalled();
        expect(virtuoso.scrollBy).not.toHaveBeenCalled();

        // Virtuoso 行重渲染完成，ref 刷新到新行（新行仍在边界内）
        useSubtitleScroll.getState().updateCurrentRef(mockRow(150, 190), 6);
        vi.advanceTimersByTime(0);

        // 实测在边界内，不产生任何滚动
        expect(virtuoso.scrollToIndex).not.toHaveBeenCalled();
        expect(virtuoso.scrollBy).not.toHaveBeenCalled();
    });

    it('延迟一拍后 ref 仍未就绪（行真未渲染），退化为远距离跳转', () => {
        const virtuoso = mockVirtuoso();
        useSubtitleScroll.setState({
            internal: {
                ...useSubtitleScroll.getState().internal,
                virtuoso: virtuoso.handle,
                visibleRange: [0, 10],
                currentListPosition: 5,
                currentRefPosition: 5,
                currentRef: mockRow(100, 140),
                lastSyncedPosition: 5,
            },
        });

        useSubtitleScroll.getState().syncIntoView(6);
        // ref 始终未刷新，延迟超时后按远跳处理
        vi.advanceTimersByTime(0);

        expect(virtuoso.scrollToIndex).toHaveBeenCalledWith(
            expect.objectContaining({ index: 6, align: 'end' })
        );
    });

    it('向下播放触底时两阶段编排：先最小距离钉住下边界，停歇后平滑归顶', () => {
        const virtuoso = mockVirtuoso();
        useSubtitleScroll.setState({
            internal: {
                ...useSubtitleScroll.getState().internal,
                virtuoso: virtuoso.handle,
                currentListPosition: 5,
                currentRefPosition: 5,
                currentRef: mockRow(600, 640), // 底部越界（安全下界 500）
                lastSyncedPosition: 4,
            },
        });

        useSubtitleScroll.getState().syncIntoView(5);

        // 第一阶段：瞬移 140px 把行底边钉到下边界
        expect(virtuoso.scrollBy).toHaveBeenCalledWith({ top: 140 });
        expect(useSubtitleScroll.getState().scrollState).toBe('AUTO_SCROLLING');
        expect(virtuoso.scrollToIndex).not.toHaveBeenCalled();

        // 第二阶段：停歇 250ms 后平滑滚动到顶部
        vi.advanceTimersByTime(250);
        expect(virtuoso.scrollToIndex).toHaveBeenCalledWith(
            expect.objectContaining({ index: 5, align: 'start', behavior: 'smooth' })
        );
    });

    it('小窗模式下触底时用原生 end 对齐替代 scrollBy，规避 transform 缩放坐标偏差', () => {
        useLayout.setState({ showSideBar: true });
        const virtuoso = mockVirtuoso();
        useSubtitleScroll.setState({
            internal: {
                ...useSubtitleScroll.getState().internal,
                virtuoso: virtuoso.handle,
                currentListPosition: 5,
                currentRefPosition: 5,
                currentRef: mockRow(600, 640),
                lastSyncedPosition: 4,
            },
        });

        useSubtitleScroll.getState().syncIntoView(5);

        expect(virtuoso.scrollBy).not.toHaveBeenCalled();
        expect(virtuoso.scrollToIndex).toHaveBeenCalledWith(
            expect.objectContaining({ index: 5, align: 'end', behavior: 'auto' })
        );
    });

    it('当前行已在安全边界内时不产生任何滚动', () => {
        const virtuoso = mockVirtuoso();
        useSubtitleScroll.setState({
            internal: {
                ...useSubtitleScroll.getState().internal,
                virtuoso: virtuoso.handle,
                currentListPosition: 5,
                currentRefPosition: 5,
                currentRef: mockRow(100, 140),
                lastSyncedPosition: 4,
            },
        });

        useSubtitleScroll.getState().syncIntoView(5);

        expect(virtuoso.scrollToIndex).not.toHaveBeenCalled();
        expect(virtuoso.scrollBy).not.toHaveBeenCalled();
        expect(useSubtitleScroll.getState().scrollState).toBe('NORMAL');
    });
});
