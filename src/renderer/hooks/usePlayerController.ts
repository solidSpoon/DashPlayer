import { create } from 'zustand';
import { SeekTime } from './useSubTitleController';
import SentenceT from '../lib/param/SentenceT';

export type PlayerControllerState = {
    muted: boolean;
    volume: number;
    playing: boolean;
    seekTime: SeekTime;
    showEn: boolean;
    showCn: boolean;
    singleRepeat: boolean;
    exactPlayTime: SeekTime;
    duration: number;
    currentSentence: SentenceT | undefined;
};

export type PlayerControllerActions = {
    setMuted: (muted: boolean) => void;
    setVolume: (volume: number) => void;
    play: () => void;
    pause: () => void;
    space: () => void;
    seekTo: (seekTime: SeekTime | ((prev: SeekTime) => SeekTime)) => void;
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
};

const usePlayerController = create<
    PlayerControllerState & PlayerControllerActions
>((set, getState) => ({
    muted: false,
    volume: 1,
    playing: false,
    seekTime: { time: 0 },
    showEn: true,
    showCn: true,
    singleRepeat: false,
    exactPlayTime: { time: 0 },
    currentSentence: undefined,
    duration: 0,
    setMuted: (muted) => set({ muted }),
    setVolume: (volume) => set({ volume }),
    play: () => set({ playing: true }),
    pause: () => set({ playing: false }),
    space: () => set((state) => ({ playing: !state.playing })),
    seekTo: (seekTime) => {
        set((state) => {
            let newSeekTime: SeekTime;
            if (typeof seekTime === 'function') {
                newSeekTime = seekTime(state.seekTime);
            } else {
                newSeekTime = seekTime;
            }
            return {
                playing: true,
                seekTime: newSeekTime,
            };
        });
    },
    changeShowEn: () => set((state) => ({ showEn: !state.showEn })),
    changeShowCn: () => set((state) => ({ showCn: !state.showCn })),
    changeShowEnCn: () =>
        set((state) => ({ showEn: !state.showEn, showCn: !state.showEn })),
    changeSingleRepeat: () =>
        set((state) => ({ singleRepeat: !state.singleRepeat })),
    updateExactPlayTime: (currentTime) => {
        getState().exactPlayTime.time = currentTime;
    },
    getExactPlayTime: () => getState().exactPlayTime.time,
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
}));

export default usePlayerController;
