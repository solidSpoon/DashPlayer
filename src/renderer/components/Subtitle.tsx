import React, { useEffect, useRef } from 'react';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import isVisible from '../lib/isVisible';
import SentenceT from '../lib/param/SentenceT';
import SideSentenceNew from './SideSentenceNew';
import { Action } from '../lib/CallAction';

interface SubtitleSubParam {
    subtitles: SentenceT[];
    currentSentence: SentenceT | undefined;
    onAction: (action: Action) => void;
}
const isSentenceVisible = (
    s: SentenceT | undefined,
    vr: number[],
    crDiv: HTMLDivElement | null
): boolean => {
    if (s === undefined || crDiv === null) {
        return false;
    }
    const index = s?.index;
    if (index) {
        if (index < vr[0] || index > vr[1]) {
            return false;
        }
    }
    return isVisible(crDiv, 50);
};
export default function Subtitle({
    subtitles,
    currentSentence,
    onAction,
}: SubtitleSubParam): React.ReactElement {
    const beforeVisible = useRef(true);
    const beforeSentence = useRef<SentenceT | undefined>(undefined);
    const currentRef: React.RefObject<HTMLDivElement> = useRef(null);

    const listRef: React.RefObject<VirtuosoHandle> = useRef(null);

    const visibleRange = useRef([0, 0]);

    console.log('vis update', currentSentence?.text ?? '', currentRef.current);
    beforeVisible.current = isSentenceVisible(
        beforeSentence.current,
        visibleRange.current,
        currentRef.current
    );
    beforeSentence.current = currentSentence;
    useEffect(() => {
        if (currentRef.current === null && currentSentence === undefined) {
            return;
        }
        const currentVisible = isSentenceVisible(
            currentSentence,
            visibleRange.current,
            currentRef.current
        );
        console.log(
            `visible, cur ${currentVisible}, bef ${beforeVisible.current}`
        );
        const index = currentSentence?.index;
        if (index && !currentVisible) {
            if (beforeVisible.current) {
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
    }, [currentSentence, subtitles, visibleRange]);

    const render = () => {
        return (
            <Virtuoso
                ref={listRef}
                className="h-full w-full"
                data={subtitles}
                rangeChanged={({ startIndex, endIndex }) => {
                    visibleRange.current = [startIndex, endIndex];
                }}
                itemContent={(index, item) => {
                    const isCurrent = item.equals(currentSentence);
                    let result = (
                        <div
                            className={`${index === 0 ? 'pt-3' : ''}
                            ${index === subtitles.length - 1 ? 'pb-52' : ''}`}
                        >
                            <SideSentenceNew
                                sentence={item}
                                onClick={(sentence) =>
                                    onAction({
                                        action: 'jump',
                                        target: sentence,
                                        time: undefined,
                                    })
                                }
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
