import { StateCreator } from 'zustand/esm';
import {
    ControllerSlice,
    PlayerSlice,
    SentenceSlice,
    SubtitleSlice,
} from './SliceTypes';
import SentenceC from '../../../common/types/SentenceC';

function getElementAt(index: number, subtitles: SentenceC[]): SentenceC {
    let targetIndex = index;
    if (targetIndex < 0) {
        targetIndex = 0;
    }
    if (targetIndex >= subtitles.length) {
        targetIndex = subtitles.length - 1;
    }
    return subtitles[targetIndex];
}
const createControllerSlice: StateCreator<
    ControllerSlice & SentenceSlice & SubtitleSlice & PlayerSlice,
    [],
    [],
    ControllerSlice
> = (setState, getState, store) => ({
    next: () => {
        const { currentSentence } = getState();
        if (currentSentence) {
            const target = getElementAt(
                currentSentence.index + 1,
                getState().subtitle
            );
            setState({ currentSentence: target });
            getState().seekTo({
                time: target.currentBegin ?? 0,
            });
        }
    },
    prev: () => {
        const { currentSentence } = getState();
        if (currentSentence) {
            const target = getElementAt(
                currentSentence.index - 1,
                getState().subtitle
            );
            setState({ currentSentence: target });
            getState().seekTo({
                time: target.currentBegin ?? 0,
            });
        }
    },
    jump: (target: SentenceC) => {
        setState({ currentSentence: target });
        getState().seekTo({
            time: target.currentBegin ?? 0,
        });
    },
    repeat: () => {
        const { currentSentence } = getState();
        if (currentSentence) {
            getState().seekTo({
                time: currentSentence.currentBegin ?? 0,
            });
        }
    },
});

export default createControllerSlice;
