import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Virtuoso } from 'react-virtuoso';
import { shallow } from 'zustand/shallow';
import { twJoin } from 'tailwind-merge';
import { AnimatePresence, motion } from 'framer-motion';
import SideSentence from '../SideSentence';
import { usePlayerState } from '@/fronted/features/player/playerState';
import { playerActions } from '@/fronted/features/player/components/PlayerActions';
import useLayout from '@/fronted/hooks/useLayout';
import { cn } from '@/fronted/lib/utils';
import useSubtitleScroll, { useSubtitleScrollState } from '@/fronted/features/player/hooks/useSubtitleScroll';
import useBoundary from '@/fronted/features/player/hooks/useBoundary';
import { FlipVertical2 } from 'lucide-react';
import { Button } from '@/fronted/components/ui/button';
import { Sentence } from '@/common/types/SentenceC';

export default function Subtitle() {
    const [mouseOver, setMouseOver] = useState(false);
    const showSideBar = useLayout((state) => state.showSideBar);
    const { currentSentence, subtitle, singleRepeat, virtualGroup } = usePlayerState((s) => ({
        currentSentence: s.currentSentence,
        subtitle: s.sentences,
        singleRepeat: s.singleRepeat,
        virtualGroup: s.virtualGroup,
    }), shallow);
    const { setBoundaryRef } = useBoundary();

    const scrollerRef = useRef<HTMLElement | Window | null>(null);

    const {
        scrollState,
        onScrolling,
        onUserFinishScrolling,
        updateCurrentRef,
        setVirtuoso,
        updateVisibleRange,
        delaySetNormal,
        syncIndexIntoView,
    } = useSubtitleScrollState((s) => ({
        scrollState: s.scrollState,
        onScrolling: s.onScrolling,
        updateCurrentRef: s.updateCurrentRef,
        onUserFinishScrolling: s.onUserFinishScrolling,
        setVirtuoso: s.setVirtuoso,
        updateVisibleRange: s.updateVisibleRange,
        delaySetNormal: s.delaySetNormal,
        syncIndexIntoView: s.syncIndexIntoView,
    }), shallow);

    const currentIndex = currentSentence?.index ?? -1;

    useEffect(() => {
        if (currentIndex < 0) {
            return;
        }
        syncIndexIntoView(currentIndex);
    }, [currentIndex, syncIndexIntoView]);

    useEffect(() => {
        const handleWheel = () => {
            useSubtitleScroll.getState().onUserInterrupt?.();
        };
        const listRefCurrent = scrollerRef.current;
        if (listRefCurrent) {
            listRefCurrent.addEventListener('wheel', handleWheel, {
                passive: true,
            });
        }
        return () => {
            if (listRefCurrent) {
                listRefCurrent.removeEventListener('wheel', handleWheel);
            }
        };
    }, []);
    const dragStateRef = useRef<{
        active: boolean;
        startIndex: number | null;
        lastIndex: number | null;
        sentence: Sentence | null;
    }>({
        active: false,
        startIndex: null,
        lastIndex: null,
        sentence: null,
    });

    const selectionRangeRef = useRef<{ start: number; end: number } | null>(null);

    const virtualGroupMeta = useMemo(() => {
        if (!virtualGroup.active || virtualGroup.sentences.length < 2) {
            return {
                hasGroup: false,
                indexSet: new Set<number>(),
                min: null as number | null,
                max: null as number | null,
            };
        }

        const sorted = [...virtualGroup.sentences]
            .map((s) => s.index)
            .sort((a, b) => a - b);
        const indexSet = new Set(sorted);
        return {
            hasGroup: true,
            indexSet,
            min: sorted[0] ?? null,
            max: sorted[sorted.length - 1] ?? null,
        };
    }, [virtualGroup]);

    const applySelectionRange = useCallback((startIndex: number, endIndex: number) => {
        const normalizedStart = Math.min(startIndex, endIndex);
        const normalizedEnd = Math.max(startIndex, endIndex);

        if (selectionRangeRef.current &&
            selectionRangeRef.current.start === normalizedStart &&
            selectionRangeRef.current.end === normalizedEnd) {
            return;
        }

        if (normalizedEnd !== normalizedStart) {
            selectionRangeRef.current = { start: normalizedStart, end: normalizedEnd };
            playerActions.setVirtualGroupByIndexRange(normalizedStart, normalizedEnd);
        } else {
            selectionRangeRef.current = null;
            playerActions.clearVirtualGroup();
        }
    }, []);

    const finalizeSelection = useCallback(() => {
        const state = dragStateRef.current;
        if (!state.active) {
            return;
        }

        state.active = false;
        const { startIndex, lastIndex, sentence } = state;

        if (
            startIndex !== null &&
            lastIndex !== null &&
            Math.abs(lastIndex - startIndex) >= 1
        ) {
            applySelectionRange(startIndex, lastIndex);
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
            startIndex: null,
            lastIndex: null,
            sentence: null,
        };
    }, [applySelectionRange, delaySetNormal, scrollState]);

    useEffect(() => {
        window.addEventListener('mouseup', finalizeSelection);
        return () => {
            window.removeEventListener('mouseup', finalizeSelection);
        };
    }, [finalizeSelection]);

    const handleMouseDown = useCallback((sentence: Sentence) => (event: React.MouseEvent) => {
        event.preventDefault();
        dragStateRef.current = {
            active: true,
            startIndex: sentence.index,
            lastIndex: sentence.index,
            sentence,
        };
        selectionRangeRef.current = null;
    }, []);

    const handleMouseEnter = useCallback((sentence: Sentence) => () => {
        const state = dragStateRef.current;
        if (!state.active || state.startIndex === null) {
            return;
        }

        state.lastIndex = sentence.index;
        applySelectionRange(state.startIndex, sentence.index);
    }, [applySelectionRange]);

    const handleMouseUp = useCallback(() => {
        finalizeSelection();
    }, [finalizeSelection]);

    const handleScrollerRef = useCallback((ref: unknown) => {
        scrollerRef.current = ref as HTMLElement;
    }, []);

    const handleRangeChanged = useCallback(({ startIndex, endIndex }: { startIndex: number; endIndex: number }) => {
        updateVisibleRange([startIndex, endIndex]);
    }, [updateVisibleRange]);

    const renderItem = useCallback((_index: number, item: Sentence) => {
        const isCurrent = !!currentSentence && item.index === currentSentence.index && item.fileHash === currentSentence.fileHash;
        const isSelected =
            virtualGroupMeta.hasGroup &&
            virtualGroupMeta.indexSet.has(item.index);
        const isGroupStart = isSelected && item.index === virtualGroupMeta.min;
        const isGroupEnd = isSelected && item.index === virtualGroupMeta.max;
        return (
            // 拖拽选区容器：鼠标按下/进入/抬起用于区间选择，不承担点击交互
            // eslint-disable-next-line jsx-a11y/no-static-element-interactions
            <div
                onMouseDown={handleMouseDown(item)}
                onMouseEnter={handleMouseEnter(item)}
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
                            updateCurrentRef(
                                ref,
                                currentSentence?.index ?? -1
                            );
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
                <AnimatePresence>
                    {scrollState === 'USER_BROWSING' && (
                        <motion.div
                            initial={{
                                scale: 0.8,
                                opacity: 0,
                                y: -10,
                            }}
                            animate={{ scale: 1, opacity: 1, y: 0 }}
                            exit={{ scale: 0.8, opacity: 0, y: -10 }}
                            onClick={() => {
                                onUserFinishScrolling();
                            }}
                            className={cn(
                                'absolute top-14 right-5 z-50',
                            )}
                        >
                            <Button
                                size="sm"
                                className={cn(
                                    'h-8 px-3 gap-1.5 rounded-full backdrop-blur-md shadow-md text-xs font-medium border transition-all duration-200',
                                    'bg-stone-900/90 text-stone-100 border-black/10 hover:bg-stone-900 hover:scale-105 active:scale-95',
                                    'dark:bg-neutral-100/90 dark:text-neutral-900 dark:border-white/20 dark:hover:bg-neutral-100'
                                )}
                            >
                                <FlipVertical2 className="w-3.5 h-3.5" />
                                <span>回到当前</span>
                            </Button>
                        </motion.div>
                    )}
                </AnimatePresence>
                <Virtuoso
                    onScroll={onScrolling}
                    scrollerRef={handleScrollerRef}
                    onMouseOver={() => {
                        setMouseOver(true);
                    }}
                    onMouseLeave={() => {
                        setMouseOver(false);
                    }}
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
