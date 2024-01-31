import React, { useEffect, useRef, useState } from 'react';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import { useShallow } from 'zustand/react/shallow';
import { twJoin } from 'tailwind-merge';
import SideSentence from './SideSentence';
import usePlayerController from '../hooks/usePlayerController';
import useLayout from '../hooks/useLayout';
import { cn } from '../../common/utils/Util';
import useScroll from '../hooks/useScroll';

export default function Subtitle() {
    const [mouseOver, setMouseOver] = useState(false);
    const showSideBar = useLayout((state) => state.showSideBar);
    const { currentSentence, subtitle, jump, singleRepeat } =
        usePlayerController(
            useShallow((state) => ({
                singleRepeat: state.singleRepeat,
                currentSentence: state.currentSentence,
                subtitle: state.subtitle,
                jump: state.jump
            }))
        );

    const scrollerRef = useRef<HTMLElement | Window | null>(null);

    const {
        setVisibleRange,
        setListRef,
        setBoundaryRef,
        updateCurrentRef ,
        onScrolling,
        scrollState,
        onUserFinishScrolling,
    } = useScroll();

    useEffect(() => {
        const handleWheel = (e: { preventDefault: () => void; }) => {
            e.preventDefault();
            console.log('wheel');
        };

        const listRefCurrent = scrollerRef.current; // listRef 是你的 ref

        if (listRefCurrent && scrollState === 'AUTO_SCROLLING') {
            listRefCurrent.addEventListener('wheel', handleWheel, { passive: false });
        }

        return () => {
            if (listRefCurrent) {
                listRefCurrent.removeEventListener('wheel', handleWheel);
            }
        };
    }, [scrollState]);
    const render = () => {
        return (
            <div className='w-full h-full relative' ref={setBoundaryRef}>
                <div
                    onClick={() => {
                        onUserFinishScrolling();
                    }}
                    className={cn(
                    'absolute top-10 right-10 rounded-full w-10 h-10 flex justify-center items-center bg-green-50 z-50',
                    scrollState !== 'USER_BROWSING' && 'hidden'
                )}></div>
                <Virtuoso
                    onScroll={onScrolling}
                    scrollerRef={(ref) => {
                        scrollerRef.current = ref;
                    }}
                    onMouseOver={() => {
                        setMouseOver(true);
                    }}
                    onMouseLeave={() => {
                        setMouseOver(false);
                    }}
                    increaseViewportBy={200}
                    defaultItemHeight={55}
                    ref={setListRef}
                    className={twJoin(
                        'h-full w-full overflow-y-scroll text-textColor',
                        'scrollbar-thumb-rounded',
                        'scrollbar-thin',
                        mouseOver &&
                        'scrollbar-thumb-scrollbarThumb hover:scrollbar-thumb-scrollbarThumbHover',
                        showSideBar && 'scrollbar-none'
                    )}
                    data={subtitle}
                    rangeChanged={({ startIndex, endIndex }) => {
                        setVisibleRange([startIndex, endIndex]);
                    }}
                    itemContent={(_index, item) => {
                        const isCurrent = item === currentSentence;
                        return (
                            <SideSentence
                                sentence={item}
                                onClick={(sentence) => jump(sentence)}
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
                        Footer: () => <div className='h-52' />,
                        Header: () => <div className={cn('h-0.5')} />
                    }}
                />
            </div>
        );
    };

    return render();
}
