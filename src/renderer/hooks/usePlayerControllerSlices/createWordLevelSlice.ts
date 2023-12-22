import { StateCreator } from 'zustand/esm';
import { InternalSlice, WordLevelSlice } from './SliceTypes';
import { p } from '../../../common/utils/Util';
import { WordLevelRes } from '../../../main/controllers/WordLevelController';

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
        familiar: true,
        translate: word,
    } as WordLevelRes;
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
    markWordLevel: async (word, familiar) => {
        if (!isWord(word)) {
            return;
        }
        const w = p(word);
        console.log('markWordLevel', w, familiar);
        await api.markWordLevel(w, familiar);
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
            console.log('syncWordsLevel', k, v);
            get().internal.wordLevel.set(p(k), v);
        });
    },
});

export default createWordLevelSlice;
