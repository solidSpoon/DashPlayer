import { StateCreator } from 'zustand/esm';
import {
    InternalSlice,
    PlayerSlice,
    SentenceSlice,
    SubtitleSlice,
    WordLevelSlice,
} from './SliceTypes';
import SentenceT from '../../lib/param/SentenceT';

const api = window.electron;
const createWordLevelSlice: StateCreator<
    WordLevelSlice & InternalSlice,
    [],
    [],
    WordLevelSlice
> = (set, get) => ({
    getWordLevel: (word) => {
        return get().internal.wordLevel.get((word ?? '').trim());
    },
    markWordLevel: async (word, level) => {
        const w = (word ?? '').trim();
        await api.markWordLevel(w, level);
        await get().syncWordsLevel([w]);
    },
    syncWordsLevel: async (words) => {
        const ws = words.map((w) => (w ?? '').trim());
        const wordLevels = await api.wordsTranslate(ws);
        wordLevels.forEach((v, k) => {
            get().internal.wordLevel.set(k, v);
        });
    },
});

export default createWordLevelSlice;
