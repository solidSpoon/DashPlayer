import { create } from 'zustand';
import SentenceT from '../lib/param/SentenceT';

export type UseCurrentSentenceState = {
    currentSentence: SentenceT | undefined;
};

export type UseCurrentSentenceActions = {
    setCurrentSentence: (
        sentence:
            | SentenceT
            | undefined
            | ((prev: SentenceT | undefined) => SentenceT | undefined)
    ) => void;
};

const useCurrentSentence = create<
    UseCurrentSentenceState & UseCurrentSentenceActions
>((set) => ({
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
}));

export default useCurrentSentence;
