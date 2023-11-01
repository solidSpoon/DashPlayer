import { StateCreator } from 'zustand/esm';
import {
    InternalSlice,
    PlayerSlice,
    SentenceSlice,
    SubtitleSlice,
    WordLevelSlice,
} from './SliceTypes';
import SentenceT from '../../lib/param/SentenceT';
import { p } from '../../../utils/Util';
import { WordLevel } from '../../../db/entity/WordLevel';

const api = window.electron;

const isWord = (word: string) => {
    if (!word) {
        return false;
    }
    if (word.trim().length <= 2) {
        return false;
    }
    return !/\d/.test(word);
};

const falseLevel = (word: string) => {
    return {
        word,
        level: 1,
        translate: word,
    } as WordLevel;
};

const createWordLevelSlice: StateCreator<
    WordLevelSlice & InternalSlice,
    [],
    [],
    WordLevelSlice
> = (set, get) => ({
    getWordLevel: (word) => {
        if (!isWord(word)) {
            return falseLevel(word);
        }
        return get().internal.wordLevel.get(p(word));
    },
    markWordLevel: async (word, level) => {
        if (!isWord(word)) {
            return;
        }
        const w = p(word);
        await api.markWordLevel(w, level);
        await get().syncWordsLevel([w]);
    },
    syncWordsLevel: async (words) => {
        // eslint-disable-next-line no-param-reassign
        words = words.filter((w) => isWord(w));
        if (words.length === 0) {
            return;
        }
        const ws = words.map((w) => p(w));
        const wordLevels = await api.wordsTranslate(ws);
        wordLevels.forEach((v, k) => {
            get().internal.wordLevel.set(p(k), v);
        });
    },
});

export default createWordLevelSlice;
