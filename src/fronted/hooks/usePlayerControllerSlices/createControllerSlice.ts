import { StateCreator } from 'zustand/esm';
import {
    ControllerSlice,
    PlayerSlice,
    SentenceSlice,
    SubtitleSlice,
} from './SliceTypes';
import CollUtil from '@/common/utils/CollUtil';
import { Sentence } from '@/common/types/SentenceC';

const createControllerSlice: StateCreator<
    ControllerSlice & SentenceSlice & SubtitleSlice & PlayerSlice,
    [],
    [],
    ControllerSlice
> = (setState, getState, store) => ({
    next: () => {
        const { currentSentence } = getState();
        if (currentSentence) {
            const target = CollUtil.validGet(getState().subtitle,currentSentence.index + 1,);
            setState({ currentSentence: target });
            const srtTender = getState().srtTender;
            srtTender?.pin(target);
            getState().seekTo({
                time: srtTender?.mapSeekTime(target)?.start ?? 0,
            });
        }
    },
    prev: () => {
        const { currentSentence } = getState();
        if (currentSentence) {
            const target = CollUtil.validGet(getState().subtitle,currentSentence.index - 1);
            setState({ currentSentence: target });
            const srtTender = getState().srtTender;
            srtTender?.pin(target);
            getState().seekTo({
                time: srtTender?.mapSeekTime(target)?.start ?? 0,
            });
        }
    },
    jump: (target: Sentence) => {
        setState({ currentSentence: target });
        const srtTender = getState().srtTender;
        srtTender?.pin(target);
        getState().seekTo({
            time: srtTender?.mapSeekTime(target)?.start ?? 0,
        });
    },
    repeat: () => {
        const { currentSentence } = getState();
        if (currentSentence) {
            const srtTender = getState().srtTender;
            srtTender?.pin(currentSentence);
            getState().seekTo({
                time: srtTender?.mapSeekTime(currentSentence)?.start ?? 0,
            });
        }
    },
});

export default createControllerSlice;
