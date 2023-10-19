import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import SentenceT from '../lib/param/SentenceT';
import useSubtitle from './useSubtitle';

export interface SeekAction {
    time: number;
}

export type PlayerControllerState = {
    internal: {
        lastSeekToOn: number;
        exactPlayTime: number;
    };
    muted: boolean;
    volume: number;
    playing: boolean;
    seekTime: SeekAction;
    showEn: boolean;
    showCn: boolean;
    singleRepeat: boolean;
    playTime: number;
    duration: number;
    currentSentence: SentenceT | undefined;
};

export type PlayerControllerActions = {
    setMuted: (muted: boolean) => void;
    setVolume: (volume: number) => void;
    play: () => void;
    pause: () => void;
    space: () => void;
    seekTo: (seekTime: SeekAction | ((prev: SeekAction) => SeekAction)) => void;
    changeShowEn: () => void;
    changeShowCn: () => void;
    changeShowEnCn: () => void;
    changeSingleRepeat: () => void;
    updateExactPlayTime: (currentTime: number) => void;
    getExactPlayTime: () => number;
    setCurrentSentence: (
        sentence:
            | SentenceT
            | undefined
            | ((prev: SentenceT | undefined) => SentenceT | undefined)
    ) => void;
    setDuration: (duration: number) => void;
    tryUpdateCurrentSentence: () => void;
};
const OVERDUE_TIME = 600;
const isTimeOverdue = (time: number) => {
    return Date.now() - time > OVERDUE_TIME;
};

function onTimeUpdate(
    getState: () => PlayerControllerState & PlayerControllerActions
) {
    const { currentSentence, singleRepeat, playing, internal } = getState();
    const { exactPlayTime, lastSeekToOn } = internal;
    if (singleRepeat) {
        if (currentSentence) {
            if (playing) {
                const isOverdue = isTimeOverdue(
                    getState().internal.lastSeekToOn
                );
                if (isOverdue && currentSentence) {
                    if (!currentSentence.isCurrentStrict(exactPlayTime)) {
                        getState().seekTo({
                            time: currentSentence.currentBegin ?? 0,
                        });
                    }
                }
            }
        }
    } else if (isTimeOverdue(lastSeekToOn)) {
        getState().tryUpdateCurrentSentence();
    }
}

const usePlayerController = create(
    subscribeWithSelector<PlayerControllerState & PlayerControllerActions>(
        (set, getState) => ({
            internal: {
                lastSeekToOn: 0,
                exactPlayTime: 0,
            },
            muted: false,
            volume: 1,
            playing: false,
            seekTime: { time: 0 },
            showEn: true,
            showCn: true,
            singleRepeat: false,
            playTime: 0,
            currentSentence: undefined,
            duration: 0,
            setMuted: (muted) => set({ muted }),
            setVolume: (volume) => set({ volume }),
            play: () => set({ playing: true }),
            pause: () => set({ playing: false }),
            space: () => set((state) => ({ playing: !state.playing })),
            seekTo: (seekTime) => {
                set((state) => {
                    let newSeekTime: SeekAction;
                    if (typeof seekTime === 'function') {
                        newSeekTime = seekTime(state.seekTime);
                    } else {
                        newSeekTime = seekTime;
                    }
                    getState().internal.lastSeekToOn = Date.now();
                    return {
                        playing: true,
                        seekTime: newSeekTime,
                    };
                });
            },
            changeShowEn: () => set((state) => ({ showEn: !state.showEn })),
            changeShowCn: () => set((state) => ({ showCn: !state.showCn })),
            changeShowEnCn: () =>
                set((state) => ({
                    showEn: !state.showEn,
                    showCn: !state.showEn,
                })),
            changeSingleRepeat: () =>
                set((state) => ({ singleRepeat: !state.singleRepeat })),
            updateExactPlayTime: (currentTime) => {
                getState().internal.exactPlayTime = currentTime;
                onTimeUpdate(getState);
            },
            getExactPlayTime: () => getState().internal.exactPlayTime,
            setCurrentSentence: (sentence) => {
                set((state) => {
                    let newSentence: SentenceT | undefined;
                    if (typeof sentence === 'function') {
                        newSentence = sentence(state.currentSentence);
                    } else {
                        newSentence = sentence;
                    }
                    return {
                        currentSentence: newSentence,
                    };
                });
            },
            setDuration: (duration) => set({ duration }),
            tryUpdateCurrentSentence: () => {
                const currentTime = getState().internal.exactPlayTime;
                const cs = getState().currentSentence;
                const isCurrent = cs?.isCurrent(currentTime) ?? false;
                if (isCurrent) {
                    if (
                        useSubtitle.getState().subtitle[cs?.index ?? 0] === cs
                    ) {
                        return;
                    }
                }
                const ns = useSubtitle.getState().getSubtitleAt(currentTime);
                if (ns) {
                    set({ currentSentence: ns });
                }
            },
        })
    )
);

let interval: number | null = null;
usePlayerController.subscribe(
    (state) => state.playing,
    (playing) => {
        if (playing) {
            const sync = () => {
                usePlayerController.setState((state) => ({
                    playTime: state.internal.exactPlayTime,
                }));
            };
            sync();
            interval = window.setInterval(sync, 300);
        } else if (interval) {
            window.clearInterval(interval);
            interval = null;
        }
    }
);
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
export const repeat = () => {
    const { currentSentence } = usePlayerController.getState();
    if (currentSentence) {
        usePlayerController.getState().seekTo({
            time: currentSentence.currentBegin ?? 0,
        });
    }
};

export const next = () => {
    const { currentSentence } = usePlayerController.getState();
    if (currentSentence) {
        const target = getElementAt(
            currentSentence.index + 1,
            useSubtitle.getState().subtitle
        );
        usePlayerController.getState().setCurrentSentence(target);
        usePlayerController.getState().seekTo({
            time: target.currentBegin ?? 0,
        });
    }
};

export const prev = () => {
    const { currentSentence } = usePlayerController.getState();
    if (currentSentence) {
        const target = getElementAt(
            currentSentence.index - 1,
            useSubtitle.getState().subtitle
        );
        usePlayerController.getState().setCurrentSentence(target);
        usePlayerController.getState().seekTo({
            time: target.currentBegin ?? 0,
        });
    }
};

export const jump = (target: SentenceT) => {
    usePlayerController.getState().setCurrentSentence(target);
    usePlayerController.getState().seekTo({
        time: target.currentBegin ?? 0,
    });
};

export default usePlayerController;
