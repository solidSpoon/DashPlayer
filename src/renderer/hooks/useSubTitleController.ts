import { useCallback, useEffect, useRef, useState } from 'react';
import SentenceT from '../lib/param/SentenceT';
import { Action } from '../lib/CallAction';
import useCurrentSentence from './useCurrentSentence';

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

const OVERDUE_TIME = 600;

const isTimeOverdue = (time: number) => {
    return Date.now() - time > OVERDUE_TIME;
};

export default function useSubTitleController(
    sentences: SentenceT[],
    getProgress: () => number
) {
    const lastSeekTime = useRef<SeekTime>({ time: 0 });
    const [seekTime, setSeekTime] = useState<SeekTime>(lastSeekTime.current);
    const { currentSentence, setCurrentSentence } = useCurrentSentence();

    const [showCn, setShowCn] = useState<boolean>(true);
    const [showEn, setShowEn] = useState<boolean>(true);

    const [singleRepeat, setSingleRepeat] = useState<boolean>(false);

    const manuallyUpdateTime = useRef<number>(Date.now());

    const getProgressRef = useRef(getProgress);
    const getCurrentSentence = useCallback(() => {
        const isOverdue = isTimeOverdue(manuallyUpdateTime.current);
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
            const newCs = getCurrentSentence();
            if (!currentSentence) {
                if (newCs) {
                    setCurrentSentence((old) => {
                        return old ?? newCs;
                    });
                }
                return;
            }
            if (singleRepeat) {
                if (currentSentence.isCurrentStrict(getProgressRef.current())) {
                    if (currentSentence !== newCs) {
                        setCurrentSentence((old) => {
                            return old === newCs ? old : newCs;
                        });
                    }
                    return;
                }
                if (seekTime.time !== SPACE_NUM) {
                    const isOverdue = isTimeOverdue(manuallyUpdateTime.current);
                    if (isOverdue) {
                        setSeekTime({
                            time: currentSentence?.currentBegin ?? 0,
                        });
                        manuallyUpdateTime.current = Date.now();
                    }
                }
            } else {
                if (!newCs) {
                    return;
                }
                if (newCs === currentSentence) {
                    return;
                }
                setCurrentSentence(newCs);
            }
        };
        const timer = setInterval(interval, 50);
        return () => {
            clearInterval(timer);
        };
    }, [
        currentSentence,
        getCurrentSentence,
        seekTime.time,
        sentences,
        setCurrentSentence,
        singleRepeat,
    ]);

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

    function showEnCn() {
        const show = !showEn;
        setShowCn(show);
        setShowEn(show);
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
            case 'single_repeat':
                setSingleRepeat((old) => !old);
                break;
            case 'show_cn':
                setShowCn((old) => !old);
                break;
            case 'show_en':
                setShowEn((old) => !old);
                break;
            case 'show_en_cn':
                showEnCn();
                break;
            default:
                break;
        }
    };

    return {
        seekAction: seekTime,
        currentSentence,
        dispatch: doAction,
        showCn,
        showEn,
        singleRepeat,
    };
}
