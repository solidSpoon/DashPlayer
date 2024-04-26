import {StateCreator} from 'zustand/esm';
import {
    InternalSlice,
    ModeSlice,
    PlayerSlice,
    SeekAction,
    SentenceSlice,
} from './SliceTypes';
import useSetting from "@/fronted/hooks/useSetting";
import usePlayerController from "@/fronted/hooks/usePlayerController";

const OVERDUE_TIME = 600;
const isTimeOverdue = (time: number) => {
    if (usePlayerController.getState().internal.onPlaySeekTime) {
        return false;
    }
    return Date.now() - time > OVERDUE_TIME;
};

function onTimeUpdate(
    getState: () => PlayerSlice & SentenceSlice & InternalSlice & ModeSlice
) {
    const {currentSentence, singleRepeat, playing, internal, autoPause} = getState();
    const {exactPlayTime, lastSeekToOn} = internal;
    if (!isTimeOverdue(lastSeekToOn)) return;

    if (currentSentence && playing && autoPause) {
        if (playing) {
            if (!currentSentence.isCurrentStrict(exactPlayTime)) {
                getState().pause();
                getState().onPlaySeek(currentSentence.currentBegin);
            }
        }
        return;
    }
    if (currentSentence && playing && singleRepeat) {
        if (!currentSentence.isCurrentStrict(exactPlayTime)) {
            getState().seekTo({
                time: currentSentence.currentBegin ?? 0,
            });
        }
        return;
    }
    if (!singleRepeat && !autoPause) {
        getState().tryUpdateCurrentSentence();
    }

}

const createPlayerSlice: StateCreator<
    PlayerSlice & SentenceSlice & InternalSlice & ModeSlice,
    [],
    [],
    PlayerSlice
> = (set, get) => ({
    internal: {
        exactPlayTime: 0,
        onPlaySeek: null,
    },
    playing: false,
    muted: false,
    volume: 1,
    playTime: 0,
    duration: 0,
    seekTime: {time: 0},
    playbackRate: 1,
    // rateStack: [],
    setMuted: (muted) => set({muted}),
    setVolume: (volume) => set({volume}),
    play: () => {
        if (get().internal.onPlaySeekTime) {
            get().seekTo({time: get().internal.onPlaySeekTime});
        } else {
            set({playing: true})
        }
    },
    pause: () => set({playing: false}),
    space: () => {
        get().playing ? get().pause() : get().play();
    },
    seekTo: (seekTime) => {
        get().internal.onPlaySeekTime = null;
        set((state) => {
            let newSeekTime: SeekAction;
            if (typeof seekTime === 'function') {
                newSeekTime = seekTime(state.seekTime);
            } else {
                newSeekTime = seekTime;
            }
            get().internal.lastSeekToOn = Date.now();
            return {
                playing: true,
                seekTime: newSeekTime,
            };
        });
    },
    setDuration: (duration) => set({duration}),
    updateExactPlayTime: (currentTime) => {
        get().internal.exactPlayTime = currentTime;
        onTimeUpdate(get);
    },
    getExactPlayTime: () => get().internal.exactPlayTime,
    setPlaybackRate: (rate) => set({playbackRate: rate}),
    nextRate: () => {
        const rates = useSetting.getState().setting('userSelect.playbackRateStack')
            .split(',')
            .map((v) => parseFloat(v))
            .filter((v) => !isNaN(v));
        if (rates.length === 0) {
            return;
        }
        const currentRate = get().playbackRate;
        const currentIndex = rates.indexOf(currentRate) === -1 ? 0 : rates.indexOf(currentRate);
        const nextIndex = (currentIndex + 1) % rates.length;
        set({playbackRate: rates[nextIndex]});
    },
    onPlaySeek: (time: number | null) => {
        get().internal.onPlaySeekTime = time;
    }
});

export default createPlayerSlice;
