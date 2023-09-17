import { useCallback, useEffect, useRef, useState } from 'react';
import SentenceT from '../lib/param/SentenceT';
import { Action } from '../lib/CallAction';

export const SPACE_NUM = -1;

export interface SeekTime {
    time: number;
}

function findCurrentSentence(
    subtitles: SentenceT[],
    currentTime: number
): SentenceT {
    return (
        subtitles.find((item) => item.isCurrent(currentTime)) ??
        subtitles[subtitles.length - 1]
    );
}

function getElementAt(index: number, subtitles: SentenceT[]): SentenceT {
    let targetIndex = index;
    if (targetIndex < 0) {
        targetIndex = 0;
    }
    if (targetIndex >= subtitles.length) {
        targetIndex = subtitles.length - 1;
    }
    return subtitles[targetIndex];
}

export default function useSubTitleController(
    sentences: SentenceT[],
    getProgress: () => number
) {
    const lastSeekTime = useRef<SeekTime>({ time: 0 });
    const [seekTime, setSeekTime] = useState<SeekTime>(lastSeekTime.current);
    const [currentSentence, setCurrentSentence] = useState<
        SentenceT | undefined
    >(undefined);

    const manuallyUpdateTime = useRef<number>(Date.now());

    const getProgressRef = useRef(getProgress);
    const getCurrentSentence = useCallback(() => {
        const isOverdue = Date.now() - manuallyUpdateTime.current > 600;
        if (
            currentSentence === undefined ||
            !currentSentence.equals(sentences[currentSentence.index]) ||
            isOverdue
        ) {
            return findCurrentSentence(sentences, getProgressRef.current());
        }
        return currentSentence;
    }, [currentSentence, sentences]);

    useEffect(() => {
        const interval = () => {
            const find: SentenceT = getCurrentSentence();
            if (find === undefined) {
                return;
            }
            setCurrentSentence(find);
        };
        const timer = setInterval(interval, 50);
        return () => {
            clearInterval(timer);
        };
    }, [currentSentence, getCurrentSentence, sentences]);

    function jumpNext() {
        const current = getCurrentSentence();
        const target = getElementAt(current.index + 1, sentences);
        setCurrentSentence(target);
        setSeekTime((state) => ({
            time: target.currentBegin ?? 0,
        }));
        manuallyUpdateTime.current = Date.now();
    }

    function jumpPrev() {
        const current = getCurrentSentence();
        const target = getElementAt(current.index - 1, sentences);
        setCurrentSentence(target);
        setSeekTime((state) => ({
            time: target.currentBegin ?? 0,
        }));
        manuallyUpdateTime.current = Date.now();
    }

    const doAction = (action: Action) => {
        switch (action.action) {
            case 'repeat':
                setSeekTime({
                    time: currentSentence?.currentBegin ?? 0,
                });
                manuallyUpdateTime.current = Date.now();
                break;
            case 'next':
                jumpNext();
                break;
            case 'prev':
                jumpPrev();
                break;
            case 'jump':
                setSeekTime({
                    time: action.target?.currentBegin ?? 0.0,
                });
                setCurrentSentence(action.target);
                manuallyUpdateTime.current = Date.now();
                break;
            case 'jump_time':
                setSeekTime({
                    time: action.time ?? 0.0,
                });
                manuallyUpdateTime.current = Date.now();
                break;
            case 'space':
                if (seekTime.time === SPACE_NUM) {
                    setSeekTime(lastSeekTime.current);
                } else {
                    lastSeekTime.current = seekTime;
                    setSeekTime({
                        time: SPACE_NUM,
                    });
                }
                manuallyUpdateTime.current = Date.now();
                break;
            case 'play':
                if (seekTime.time === SPACE_NUM) {
                    setSeekTime(lastSeekTime.current);
                }
                break;
            case 'pause':
                if (seekTime.time !== SPACE_NUM) {
                    lastSeekTime.current = seekTime;
                    setSeekTime({
                        time: SPACE_NUM,
                    });
                }
                break;
            default:
                break;
        }
    };

    return {
        seekAction: seekTime,
        currentSentence,
        dispatch: doAction,
    };
}
