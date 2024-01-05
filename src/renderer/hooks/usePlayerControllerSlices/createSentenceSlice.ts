import { StateCreator } from 'zustand/esm';
import {
    ControllerSlice,
    InternalSlice,
    PlayerSlice,
    SentenceSlice,
    SubtitleSlice
} from './SliceTypes';
import SentenceT from '../../../common/types/SentenceT';
import { SubtitleAdjustmentTypeConverter } from '../../../common/types/SubtitleAdjustmentTypeConverter';
import useFile from '../useFile';
import hash from '../../../common/utils/hash';
const api = window.electron;
const createSentenceSlice: StateCreator<
    PlayerSlice & SentenceSlice & InternalSlice & SubtitleSlice & ControllerSlice,
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
                currentSentence: newSentence
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

    adjustStart: (time) => {
        let clone = get().currentSentence?.clone();
        if (!clone) {
            return;
        }
        if (clone.originalBegin === undefined) {
            clone.originalBegin = clone.currentBegin;
        }
        clone.currentBegin = (clone.originalBegin??0) + time;
        get().mergeSubtitle([clone]);
        set({
            currentSentence: clone
        })
        get().repeat();
        let subtitleFile = useFile.getState().subtitleFile;
        if (!subtitleFile) {
            return;
        }
        api.subtitleTimestampRecord(SubtitleAdjustmentTypeConverter.fromSentence(clone, subtitleFile));
    },

    adjustEnd: (time) => {
        let clone = get().currentSentence?.clone();
        if (!clone) {
            return;
        }
        if (clone.originalEnd === undefined) {
            clone.originalEnd = clone.currentEnd;
        }
        clone.currentEnd = (clone.originalEnd??0) + time;
        get().mergeSubtitle([clone]);
        set({
            currentSentence: clone
        })
        get().repeat();
        let subtitleFile = useFile.getState().subtitleFile;
        if (!subtitleFile) {
            return;
        }
        api.subtitleTimestampRecord(SubtitleAdjustmentTypeConverter.fromSentence(clone, subtitleFile));
    },

    clearAdjust: () => {
        let clone = get().currentSentence?.clone();
        if (!clone) {
            return;
        }
        if (clone.originalBegin !== undefined) {
            clone.currentBegin = clone.originalBegin;
        }
        if (clone.originalEnd !== undefined) {
            clone.currentEnd = clone.originalEnd;
        }
        get().mergeSubtitle([clone]);
        set({
            currentSentence: clone
        })
        get().repeat();
        let subtitleFile = useFile.getState().subtitleFile;
        if (!subtitleFile) {
            return;
        }
        api.subtitleTimestampDeleteByKey(hash(`${subtitleFile.path}-${clone.index}-${clone.text}`));
    }
});

export const sentenceClearAllAdjust =async () => {
    await api.subtitleTimestampDeleteByPath(useFile.getState().subtitleFile?.path ?? '');
    useFile.setState((state) => {
        return {
            subtitleFile: state.subtitleFile
                ? {
                    ...state.subtitleFile,
                }
                : undefined,
        };
    });
}


export default createSentenceSlice;
