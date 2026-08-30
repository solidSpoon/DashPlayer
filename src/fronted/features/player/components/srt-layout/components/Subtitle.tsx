import React, { useCallback, useEffect, useMemo, useRef } from 'react';
import { Virtuoso } from 'react-virtuoso';
import { shallow } from 'zustand/shallow';
import { twJoin } from 'tailwind-merge';
import SideSentence from '../SideSentence';
import { usePlayerState } from '@/fronted/features/player/playerState';
import { playerActions } from '@/fronted/features/player/components/PlayerActions';
import useLayout from '@/fronted/hooks/useLayout';
import { cn } from '@/fronted/lib/utils';
import useSubtitleScroll, { useSubtitleScrollState } from '@/fronted/features/player/hooks/useSubtitleScroll';
import useBoundary from '@/fronted/features/player/hooks/useBoundary';
import { Sentence } from '@/common/types/SentenceC';

export default function Subtitle() {
    const showSideBar = useLayout((state) => state.showSideBar);
    const { currentSentence, subtitle, singleRepeat, virtualGroup } = usePlayerState((s) => ({
        currentSentence: s.currentSentence,
        subtitle: s.sentences,
        singleRepeat: s.singleRepeat,
        virtualGroup: s.virtualGroup,
    }), shallow);
    const { setBoundaryRef } = useBoundary();

    const scrollerRef = useRef<HTMLElement | Window | null>(null);
    /** 卸载当前滚动容器上用户输入监听的函数；容器（重）挂载时先卸载旧监听 */
    const detachUserInputRef = useRef<(() => void) | null>(null);

    const {
        scrollState,
        onScrolling,
        updateCurrentRef,
        setVirtuoso,
        updateVisibleRange,
        delaySetNormal,
        syncIntoView,
    } = useSubtitleScrollState((s) => ({
        scrollState: s.scrollState,
        onScrolling: s.onScrolling,
        updateCurrentRef: s.updateCurrentRef,
        setVirtuoso: s.setVirtuoso,
        updateVisibleRange: s.updateVisibleRange,
        delaySetNormal: s.delaySetNormal,
        syncIntoView: s.syncIntoView,
    }), shallow);

    const currentListPosition = useMemo(() => {
        if (!currentSentence || subtitle.length === 0) {
            return -1;
        }
        return subtitle.findIndex(
            (item) => item.index === currentSentence.index && item.fileHash === currentSentence.fileHash
        );
    }, [currentSentence, subtitle]);

    useEffect(() => {
        if (currentListPosition < 0) {
            return;
        }
        syncIntoView(currentListPosition);
    }, [currentListPosition, syncIntoView]);

    useEffect(() => {
        return () => {
            detachUserInputRef.current?.();
            detachUserInputRef.current = null;
        };
    }, []);
    const dragStateRef = useRef<{
        active: boolean;
        startListPosition: number | null;
        lastListPosition: number | null;
        sentence: Sentence | null;
    }>({
        active: false,
        startListPosition: null,
        lastListPosition: null,
        sentence: null,
    });

    const selectionRangeRef = useRef<{ startPos: number; endPos: number } | null>(null);

    const virtualGroupMeta = useMemo(() => {
        if (!virtualGroup.active || virtualGroup.sentences.length < 2) {
            return {
                hasGroup: false,
                keyGroupSet: new Set<string>(),
                firstKey: null as string | null,
                lastKey: null as string | null,
            };
        }

        const keyGroupSet = new Set(virtualGroup.sentences.map((s) => `${s.fileHash}-${s.index}`));
        const first = virtualGroup.sentences[0];
        const last = virtualGroup.sentences[virtualGroup.sentences.length - 1];
        return {
            hasGroup: true,
            keyGroupSet,
            firstKey: first ? `${first.fileHash}-${first.index}` : null,
            lastKey: last ? `${last.fileHash}-${last.index}` : null,
        };
    }, [virtualGroup]);

    const applySelectionRange = useCallback((startPos: number, endPos: number) => {
        const normalizedStart = Math.min(startPos, endPos);
        const normalizedEnd = Math.max(startPos, endPos);

        if (selectionRangeRef.current &&
            selectionRangeRef.current.startPos === normalizedStart &&
            selectionRangeRef.current.endPos === normalizedEnd) {
            return;
        }

        if (normalizedEnd !== normalizedStart) {
            selectionRangeRef.current = { startPos: normalizedStart, endPos: normalizedEnd };
            const selectedSentences = subtitle.slice(normalizedStart, normalizedEnd + 1);
            playerActions.setVirtualGroupBySentences(selectedSentences);
        } else {
            selectionRangeRef.current = null;
            playerActions.clearVirtualGroup();
        }
    }, [subtitle]);

    const finalizeSelection = useCallback(() => {
        const state = dragStateRef.current;
        if (!state.active) {
            return;
        }

        state.active = false;
        const { startListPosition, lastListPosition, sentence } = state;

        if (
            startListPosition !== null &&
            lastListPosition !== null &&
            Math.abs(lastListPosition - startListPosition) >= 1
        ) {
            applySelectionRange(startListPosition, lastListPosition);
        } else if (sentence) {
            playerActions.clearVirtualGroup();
            playerActions.gotoSentence(sentence);
            if (scrollState === 'USER_BROWSING') {
                delaySetNormal();
            }
        }

        selectionRangeRef.current = null;
        dragStateRef.current = {
            active: false,
            startListPosition: null,
            lastListPosition: null,
            sentence: null,
        };
    }, [applySelectionRange, delaySetNormal, scrollState]);

    useEffect(() => {
        window.addEventListener('mouseup', finalizeSelection);
        return () => {
            window.removeEventListener('mouseup', finalizeSelection);
        };
    }, [finalizeSelection]);

    const handleMouseDown = useCallback((sentence: Sentence, listPosition: number) => (event: React.MouseEvent) => {
        event.preventDefault();
        dragStateRef.current = {
            active: true,
            startListPosition: listPosition,
            lastListPosition: listPosition,
            sentence,
        };
        selectionRangeRef.current = null;
    }, []);

    const handleMouseEnter = useCallback((_sentence: Sentence, listPosition: number) => () => {
        const state = dragStateRef.current;
        if (!state.active || state.startListPosition === null) {
            return;
        }

        state.lastListPosition = listPosition;
        applySelectionRange(state.startListPosition, listPosition);
    }, [applySelectionRange]);

    const handleMouseUp = useCallback(() => {
        finalizeSelection();
    }, [finalizeSelection]);

    /**
     * Virtuoso 滚动容器（重）挂载时挂载/卸载用户输入监听。
     * 滚轮、滚动条拖拽、翻页键发生在自动滚动（AUTO_SCROLLING）期间时立即中断跟读，
     * 避免平滑动画与用户输入争夺滚动位置；其他状态下 onUserInterrupt 自身为空操作。
     */
    const handleScrollerRef = useCallback((ref: unknown) => {
        detachUserInputRef.current?.();
        detachUserInputRef.current = null;
        const scroller = ref as HTMLElement | null;
        scrollerRef.current = scroller;
        if (!scroller) {
            return;
        }
        const interruptAutoScroll = () => {
            useSubtitleScroll.getState().onUserInterrupt();
        };
        const handlePointerDown = (e: PointerEvent) => {
            // 事件 target 为滚动容器本身说明按下的是滚动条区域，而非字幕行
            if (e.target === scroller) {
                interruptAutoScroll();
            }
        };
        const handleKeyDown = (e: KeyboardEvent) => {
            if (['PageUp', 'PageDown', 'Home', 'End', 'ArrowUp', 'ArrowDown'].includes(e.key)) {
                interruptAutoScroll();
            }
        };
        scroller.addEventListener('wheel', interruptAutoScroll, { passive: true });
        scroller.addEventListener('pointerdown', handlePointerDown);
        scroller.addEventListener('keydown', handleKeyDown);
        detachUserInputRef.current = () => {
            scroller.removeEventListener('wheel', interruptAutoScroll);
            scroller.removeEventListener('pointerdown', handlePointerDown);
            scroller.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    const handleRangeChanged = useCallback(({ startIndex, endIndex }: { startIndex: number; endIndex: number }) => {
        updateVisibleRange([startIndex, endIndex]);
    }, [updateVisibleRange]);

    const renderItem = useCallback((listPosition: number, item: Sentence) => {
        const isCurrent = !!currentSentence && item.index === currentSentence.index && item.fileHash === currentSentence.fileHash;
        const itemKey = `${item.fileHash}-${item.index}`;
        const isSelected =
            virtualGroupMeta.hasGroup &&
            virtualGroupMeta.keyGroupSet.has(itemKey);
        const isGroupStart = isSelected && itemKey === virtualGroupMeta.firstKey;
        const isGroupEnd = isSelected && itemKey === virtualGroupMeta.lastKey;
        return (
            // 拖拽选区容器：鼠标按下/进入/抬起用于区间选择，不承担点击交互
            // eslint-disable-next-line jsx-a11y/no-static-element-interactions
            <div
                onMouseDown={handleMouseDown(item, listPosition)}
                onMouseEnter={handleMouseEnter(item, listPosition)}
                onMouseUp={handleMouseUp}
            >
                <SideSentence
                    sentence={item}
                    onClick={() => {
                        // handled via drag finalize logic
                    }}
                    isCurrent={isCurrent}
                    isRepeat={singleRepeat}
                    selectionState={
                        isSelected
                            ? {
                                isMember: true,
                                isGroupStart,
                                isGroupEnd,
                            }
                            : undefined
                    }
                    ref={(ref) => {
                        if (isCurrent) {
                            updateCurrentRef(ref, listPosition);
                        }
                    }}
                />
            </div>
        );
    }, [
        currentSentence,
        handleMouseDown,
        handleMouseEnter,
        handleMouseUp,
        singleRepeat,
        updateCurrentRef,
        virtualGroupMeta,
    ]);

    const render = () => {
        return (
            <div className="w-full h-full relative" ref={setBoundaryRef}>
                <Virtuoso
                    onScroll={onScrolling}
                    scrollerRef={handleScrollerRef}
                    increaseViewportBy={200}
                    minOverscanItemCount={{ top: 3, bottom: 6 }}
                    defaultItemHeight={55}
                    ref={setVirtuoso}
                    className={twJoin(
                        'h-full w-full overflow-y-auto text-stone-600 dark:text-neutral-200 py-2',
                        'scrollbar-thin scrollbar-thumb-rounded-full',
                        'scrollbar-thumb-stone-300/60 dark:scrollbar-thumb-neutral-700/60 hover:scrollbar-thumb-stone-400 dark:hover:scrollbar-thumb-neutral-500',
                        showSideBar && 'scrollbar-none'
                    )}
                    data={subtitle}
                    rangeChanged={handleRangeChanged}
                    itemContent={renderItem}
                    components={{
                        Footer: () => <div className="h-52" />,
                        Header: () => <div className={cn('h-0.5')} />,
                    }}
                />
            </div>
        );
    };

    return render();
}
