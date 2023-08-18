import React, { Component, useEffect, useRef, useState } from 'react';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import isVisible from '../lib/isVisible';
import SentenceT from '../lib/param/SentenceT';
import SideSentenceNew from './SideSentenceNew';
import FileT from '../lib/param/FileT';

interface SubtitleSubParam {
    subtitles: SentenceT[];
    currentSentence: SentenceT | undefined;
    action: Action;
    onJumpTo: (sentence: SentenceT) => void;
}

export interface Action {
    num: number;
    action: 'repeat' | 'next' | 'prev' | 'jump' | 'jump_time' | 'none';
    target: SentenceT | undefined;
    time: number | undefined;
}

export default function SubtitleSub({
    subtitles,
    currentSentence,
    onJumpTo,
}: SubtitleSubParam): React.ReactElement {
    const SCROOL_BOUNDARY = 50;

    const currentRef: React.RefObject<HTMLDivElement> = useRef(null);

    const listRef: React.RefObject<VirtuosoHandle> = useRef(null);

    let visibleRange: [number, number] = [0, 0];

    const [current, setCurrent] = useState<SentenceT | undefined>(undefined);

    useEffect(() => {
        const beforeVisable = true;
        if (currentRef.current === null && currentSentence === undefined) {
            return;
        }
        const currentVisable = this.isIsVisible();
        const index = this.currentSentence?.index;
        if (index && !currentVisable) {
            if (beforeVisable) {
                listRef.current?.scrollToIndex({
                    index: index - 1 >= 0 ? index - 1 : 0,
                    align: 'start',
                    behavior: 'smooth',
                });
            } else {
                listRef.current?.scrollIntoView({
                    index,
                    align: 'start',
                    behavior: 'auto',
                });
                listRef.current?.scrollIntoView({
                    index: index - 1 >= 0 ? index - 1 : 0,
                    align: 'start',
                    behavior: 'auto',
                });
            }
        }
    }, [subtitles]);

    const isIsVisible = (): boolean => {
        const index = currentSentence?.index;
        if (index) {
            if (index < visibleRange[0] || index > visibleRange[1]) {
                return false;
            }
        }
        const currentDiv = currentRef.current;
        if (currentDiv === null) {
            return false;
        }
        return isVisible(currentDiv, SCROOL_BOUNDARY);
    };

    const render = () => {
        return (
            <Virtuoso
                ref={listRef}
                className="h-full w-full"
                data={subtitles}
                rangeChanged={({ startIndex, endIndex }) => {
                    visibleRange = [startIndex, endIndex];
                }}
                itemContent={(index, item) => {
                    const isCurrent = item.equals(current);
                    let result = (
                        <div
                            className={`${index === 0 ? 'pt-3' : ''}
                            ${index === subtitles.length - 1 ? 'pb-52' : ''}`}
                        >
                            <SideSentenceNew
                                sentence={item}
                                onClick={(sentence) => onJumpTo(sentence)}
                                isCurrent={isCurrent}
                            />
                        </div>
                    );
                    if (isCurrent) {
                        result = (
                            <div key={`${item.getKey()}div`} ref={currentRef}>
                                {result}
                            </div>
                        );
                    }
                    return result;
                }}
            />
        );
    };

    return render();
}
