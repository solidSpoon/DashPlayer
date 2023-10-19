import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import SentenceT from '../lib/param/SentenceT';
import createSubtitleSlice from './usePlayerControllerSlices/createSubtitleSlice';
import {
    InternalSlice,
    ModeSlice,
    PlayerSlice,
    SentenceSlice,
    SubtitleSlice,
} from './usePlayerControllerSlices/SliceTypes';
import createPlayerSlice from './usePlayerControllerSlices/createPlayerSlice';
import createSentenceSlice from './usePlayerControllerSlices/createSentenceSlice';
import createInternalSlice from './usePlayerControllerSlices/createInternalSlice';
import createModeSlice from './usePlayerControllerSlices/createModeSlice';

const usePlayerController = create<
    PlayerSlice & SentenceSlice & ModeSlice & InternalSlice & SubtitleSlice
>()(
    subscribeWithSelector((...a) => ({
        ...createPlayerSlice(...a),
        ...createSentenceSlice(...a),
        ...createModeSlice(...a),
        ...createInternalSlice(...a),
        ...createSubtitleSlice(...a),
    }))
);

function getElementAt(index: number, subtitles: SentenceT[]): SentenceT {
    let targetIndex = index;
    if (targetIndex < 0) {
        targetIndex = 0;
    }
    if (targetIndex >= subtitles.length) {
        targetIndex = subtitles.length - 1;
    }
    return subtitles[targetIndex];
}
export const repeat = () => {
    const { currentSentence } = usePlayerController.getState();
    if (currentSentence) {
        usePlayerController.getState().seekTo({
            time: currentSentence.currentBegin ?? 0,
        });
    }
};

export const next = () => {
    const { currentSentence } = usePlayerController.getState();
    if (currentSentence) {
        const target = getElementAt(
            currentSentence.index + 1,
            usePlayerController.getState().subtitle
        );
        usePlayerController.getState().setCurrentSentence(target);
        usePlayerController.getState().seekTo({
            time: target.currentBegin ?? 0,
        });
    }
};

export const prev = () => {
    const { currentSentence } = usePlayerController.getState();
    if (currentSentence) {
        const target = getElementAt(
            currentSentence.index - 1,
            usePlayerController.getState().subtitle
        );
        usePlayerController.getState().setCurrentSentence(target);
        usePlayerController.getState().seekTo({
            time: target.currentBegin ?? 0,
        });
    }
};

export const jump = (target: SentenceT) => {
    usePlayerController.getState().setCurrentSentence(target);
    usePlayerController.getState().seekTo({
        time: target.currentBegin ?? 0,
    });
};

export default usePlayerController;
