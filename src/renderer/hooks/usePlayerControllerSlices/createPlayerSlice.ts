import { StateCreator } from 'zustand/esm';
import {
    InternalSlice,
    ModeSlice,
    PlayerSlice,
    SeekAction,
    SentenceSlice,
} from './SliceTypes';

const OVERDUE_TIME = 600;
const isTimeOverdue = (time: number) => {
    return Date.now() - time > OVERDUE_TIME;
};
function onTimeUpdate(
    getState: () => PlayerSlice & SentenceSlice & InternalSlice & ModeSlice
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
const createPlayerSlice: StateCreator<
    PlayerSlice & SentenceSlice & InternalSlice & ModeSlice,
    [],
    [],
    PlayerSlice
> = (set, get) => ({
    internal: {
        exactPlayTime: 0,
    },
    playing: false,
    muted: false,
    volume: 1,
    playTime: 0,
    duration: 0,
    seekTime: { time: 0 },
    playbackRate: 1,
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
            get().internal.lastSeekToOn = Date.now();
            return {
                playing: true,
                seekTime: newSeekTime,
            };
        });
    },
    setDuration: (duration) => set({ duration }),
    updateExactPlayTime: (currentTime) => {
        get().internal.exactPlayTime = currentTime;
        onTimeUpdate(get);
    },
    getExactPlayTime: () => get().internal.exactPlayTime,
    setPlaybackRate: (rate) => set({ playbackRate: rate }),
});

export default createPlayerSlice;
