import React, { useEffect, useRef, useState } from 'react';
import { Virtuoso } from 'react-virtuoso';
import { shallow } from 'zustand/shallow';
import { twJoin } from 'tailwind-merge';
import { MdOutlineVerticalAlignCenter } from 'react-icons/md';
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

export default function Subtitle() {
    const [mouseOver, setMouseOver] = useState(false);
    const showSideBar = useLayout((state) => state.showSideBar);
    const { currentSentence, subtitle, singleRepeat } = usePlayerV2State((s) => ({
        currentSentence: s.currentSentence,
        subtitle: s.sentences,
        singleRepeat: s.singleRepeat
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
                        return (
                            <SideSentence
                                sentence={item}
                                onClick={(sentence) => {
                                    playerV2Actions.gotoSentence(sentence);
                                    if (scrollState === 'USER_BROWSING') {
                                        delaySetNormal();
                                    }
                                }}
                                isCurrent={isCurrent}
                                isRepeat={singleRepeat}
                                ref={(ref) => {
                                    if (isCurrent) {
                                        updateCurrentRef(
                                            ref,
                                            currentSentence?.index ?? -1
                                        );
                                    }
                                }}
                            />
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
