import { describe, it, expect, beforeEach } from 'vitest';
import useSubtitleScroll from '../useSubtitleScroll';

describe('useSubtitleScroll', () => {
    beforeEach(() => {
        useSubtitleScroll.setState({
            scrollState: 'NORMAL',
            boundary: { yt: 50, yb: 500 },
            internal: {
                virtuoso: null,
                currentIndex: -1,
                scrollStatusTimer: undefined,
                scrollTopTimer: undefined,
                currentRef: null,
                visibleRange: [0, 10],
                syncPending: false,
                lastSyncIndex: -1,
                interrupted: false,
            },
        });
    });



    it('should switch to USER_BROWSING when current item scrolls out of safe boundary', () => {
        const mockEle = {
            getBoundingClientRect: () => ({
                top: 20, // out of bounds (yt: 50)
                bottom: 45,
                height: 25,
                width: 100,
                left: 0,
                right: 100,
                x: 0,
                y: 20,
                toJSON: () => {},
            }),
        } as unknown as HTMLDivElement;

        useSubtitleScroll.setState({
            internal: {
                ...useSubtitleScroll.getState().internal,
                currentIndex: 2,
                currentRef: mockEle,
                visibleRange: [0, 10],
            },
        });

        useSubtitleScroll.getState().onScrolling();
        expect(useSubtitleScroll.getState().scrollState).toBe('USER_BROWSING');
    });

    it('should stay or restore to NORMAL when current item is within safe boundary', () => {
        vi.useFakeTimers();
        const mockEle = {
            getBoundingClientRect: () => ({
                top: 100, // within bounds (yt: 50, yb: 500)
                bottom: 140,
                height: 40,
                width: 100,
                left: 0,
                right: 100,
                x: 0,
                y: 100,
                toJSON: () => {},
            }),
        } as unknown as HTMLDivElement;

        useSubtitleScroll.setState({
            scrollState: 'USER_BROWSING',
            internal: {
                ...useSubtitleScroll.getState().internal,
                currentIndex: 2,
                currentRef: mockEle,
                visibleRange: [0, 10],
            },
        });

        useSubtitleScroll.getState().onScrolling();
        vi.advanceTimersByTime(200);
        expect(useSubtitleScroll.getState().scrollState).toBe('NORMAL');
        vi.useRealTimers();
    });

    it('should respect user wheel interruption and switch to USER_BROWSING', () => {
        useSubtitleScroll.setState({
            scrollState: 'AUTO_SCROLLING',
        });

        useSubtitleScroll.getState().onUserInterrupt();
        expect(useSubtitleScroll.getState().scrollState).toBe('USER_BROWSING');
        expect(useSubtitleScroll.getState().internal.interrupted).toBe(true);

        // Next onScroll should clear interrupted flag without triggering state flip
        useSubtitleScroll.getState().onScrolling();
        expect(useSubtitleScroll.getState().internal.interrupted).toBe(false);
    });
});
