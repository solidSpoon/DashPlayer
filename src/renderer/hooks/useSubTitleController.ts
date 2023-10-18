import { useCallback, useEffect, useRef, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import SentenceT from '../lib/param/SentenceT';
import { Action } from '../lib/CallAction';
import useCurrentSentence from './useCurrentSentence';
import usePlayerController from './usePlayerController';

export const SPACE_NUM = -1;

export interface SeekTime {
    time: number;
}

function findCurrentSentence(subtitles: SentenceT[]): SentenceT {
    const currentTime = usePlayerController.getState().getExactPlayTime();
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

export default function useSubTitleController(sentences: SentenceT[]) {
    const seekTime = usePlayerController((state) => state.seekTime);
    const {
        seekTo,
        playing,
        singleRepeat,
        getExactPlayTime,
        currentSentence,
        setCurrentSentence,
    } = usePlayerController(
        useShallow((state) => ({
            seekTo: state.seekTo,
            playing: state.playing,
            singleRepeat: state.singleRepeat,
            getExactPlayTime: state.getExactPlayTime,
            currentSentence: state.currentSentence,
            setCurrentSentence: state.setCurrentSentence,
        }))
    );
    const manuallyUpdateTime = useRef<number>(Date.now());
    const getCurrentSentence = useCallback(() => {
        const isOverdue = isTimeOverdue(manuallyUpdateTime.current);
        if (
            currentSentence === undefined ||
            !currentSentence.equals(sentences[currentSentence.index]) ||
            isOverdue
        ) {
            return findCurrentSentence(sentences);
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
                if (currentSentence.isCurrentStrict(getExactPlayTime())) {
                    if (currentSentence !== newCs) {
                        setCurrentSentence((old) => {
                            return old === newCs ? old : newCs;
                        });
                    }
                    return;
                }
                if (!playing) {
                    const isOverdue = isTimeOverdue(manuallyUpdateTime.current);
                    if (isOverdue) {
                        seekTo({
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
        getExactPlayTime,
        playing,
        seekTo,
        setCurrentSentence,
        singleRepeat,
    ]);

    function jumpNext() {
        const current = getCurrentSentence();
        const target = getElementAt(current.index + 1, sentences);
        setCurrentSentence(target);
        seekTo((state) => ({
            time: target.currentBegin ?? 0,
        }));
        manuallyUpdateTime.current = Date.now();
    }

    function jumpPrev() {
        const current = getCurrentSentence();
        const target = getElementAt(current.index - 1, sentences);
        setCurrentSentence(target);
        seekTo((state) => ({
            time: target.currentBegin ?? 0,
        }));
        manuallyUpdateTime.current = Date.now();
    }
    const doAction = (action: Action) => {
        switch (action.action) {
            case 'repeat':
                seekTo({
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
                seekTo({
                    time: action.target?.currentBegin ?? 0.0,
                });
                setCurrentSentence(action.target);
                manuallyUpdateTime.current = Date.now();
                break;
            case 'jump_time':
                seekTo({
                    time: action.time ?? 0.0,
                });
                manuallyUpdateTime.current = Date.now();
                break;
            default:
                break;
        }
    };

    return {
        seekAction: seekTime,
        dispatch: doAction,
        singleRepeat,
    };
}
