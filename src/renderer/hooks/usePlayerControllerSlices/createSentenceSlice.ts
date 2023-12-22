import { StateCreator } from 'zustand/esm';
import {
    InternalSlice,
    PlayerSlice,
    SentenceSlice,
    SubtitleSlice,
} from './SliceTypes';
import SentenceT from '../../../common/types/SentenceT';

const createSentenceSlice: StateCreator<
    PlayerSlice & SentenceSlice & InternalSlice & SubtitleSlice,
    [],
    [],
    SentenceSlice
> = (set, get) => ({
    currentSentence: undefined,
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
    tryUpdateCurrentSentence: () => {
        const currentTime = get().internal.exactPlayTime;
        const cs = get().currentSentence;
        const isCurrent = cs?.isCurrent(currentTime) ?? false;
        if (isCurrent) {
            if (get().subtitle[cs?.index ?? 0] === cs) {
                return;
            }
        }
        const ns = get().getSubtitleAt(currentTime);
        if (ns) {
            set({ currentSentence: ns });
        }
    },
});

export default createSentenceSlice;
