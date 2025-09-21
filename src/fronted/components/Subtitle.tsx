import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Virtuoso } from 'react-virtuoso';
import { shallow } from 'zustand/shallow';
import { twJoin } from 'tailwind-merge';
import { AnimatePresence, motion } from 'framer-motion';
import SideSentence from '@/fronted/pages/player/pa-player/SideSentence';
import { usePlayerV2State } from '@/fronted/hooks/usePlayerV2State';
import { playerV2Actions } from '@/fronted/components/player-components';
import useLayout from '../hooks/useLayout';
import {cn} from "@/fronted/lib/utils";
import useSubtitleScroll from '../hooks/useSubtitleScroll';
import useBoundary from '../hooks/useBoundary';
import {FlipVertical2} from "lucide-react";
import {Button} from "@/fronted/components/ui/button";
import { Sentence } from '@/common/types/SentenceC';

export default function Subtitle() {
    const [mouseOver, setMouseOver] = useState(false);
    const showSideBar = useLayout((state) => state.showSideBar);
    const { currentSentence, subtitle, singleRepeat, virtualGroup } = usePlayerV2State((s) => ({
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
    } = useSubtitleScroll((s) => ({
        scrollState: s.scrollState,
        onScrolling: s.onScrolling,
        updateCurrentRef: s.updateCurrentRef,
        onUserFinishScrolling: s.onUserFinishScrolling,
        setVirtuoso: s.setVirtuoso,
        updateVisibleRange: s.updateVisibleRange,
        delaySetNormal: s.delaySetNormal,
    }));

    useEffect(() => {
        const handleWheel = (e: { preventDefault: () => void }) => {
            if (useSubtitleScroll.getState().scrollState === 'AUTO_SCROLLING') {
                e.preventDefault();
            }
        };
        const listRefCurrent = scrollerRef.current; // listRef 是你的 ref
        if (listRefCurrent) {
            listRefCurrent.addEventListener('wheel', handleWheel, {
                passive: false,
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
            playerV2Actions.setVirtualGroupByIndexRange(normalizedStart, normalizedEnd);
        } else {
            selectionRangeRef.current = null;
            playerV2Actions.clearVirtualGroup();
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
            playerV2Actions.clearVirtualGroup();
            playerV2Actions.gotoSentence(sentence);
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

    const render = () => {
        return (
            <div className="w-full h-full relative" ref={setBoundaryRef}>
                <AnimatePresence>
                    {scrollState === 'USER_BROWSING' && (
                        <motion.div
                            initial={{
                                scale: 0,
                                opacity: 0,
                            }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0, opacity: 0 }}
                            onClick={() => {
                                onUserFinishScrolling();
                            }}
                            className={cn(
                                'absolute top-12 right-12  z-50 ',
                            )}
                        >
                            <Button size={'icon'}
                                    className={cn('bg-purple-600 hover:bg-purple-700',
                                        'dark:bg-purple-700 dark:hover:bg-purple-800',
                                        'transition-colors duration-200 rounded-full drop-shadow-md')}
                            >
                                <FlipVertical2 className={'text-purple-50'}/>
                            </Button>
                        </motion.div>
                    )}
                </AnimatePresence>
                <Virtuoso
                    onScroll={onScrolling}
                    scrollerRef={(ref) => {
                        scrollerRef.current = ref as HTMLElement;
                    }}
                    onMouseOver={() => {
                        setMouseOver(true);
                    }}
                    onMouseLeave={() => {
                        setMouseOver(false);
                    }}
                    increaseViewportBy={200}
                    defaultItemHeight={55}
                    ref={setVirtuoso}
                    className={twJoin(
                        'h-full w-full overflow-y-scroll text-stone-600 dark:text-neutral-200',
                        'scrollbar-thin scrollbar-thumb-rounded-full',
                        mouseOver &&
                            'scrollbar-thumb-zinc-400 dark:scrollbar-thumb-stone-400 hover:scrollbar-thumb-zinc-500 dark:hover:scrollbar-thumb-stone-300',
                        showSideBar && 'scrollbar-none'
                    )}
                    data={subtitle}
                    rangeChanged={({ startIndex, endIndex }) => {
                        updateVisibleRange([startIndex, endIndex]);
                    }}
                    itemContent={(_index, item) => {
                        const isCurrent = !!currentSentence && item.index === currentSentence.index && item.fileHash === currentSentence.fileHash;
                        const isSelected =
                            virtualGroupMeta.hasGroup &&
                            virtualGroupMeta.indexSet.has(item.index);
                        const isGroupStart = isSelected && item.index === virtualGroupMeta.min;
                        const isGroupEnd = isSelected && item.index === virtualGroupMeta.max;
                        return (
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
                    }}
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
