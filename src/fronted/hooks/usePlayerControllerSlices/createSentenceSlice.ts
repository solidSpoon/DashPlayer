import { StateCreator } from 'zustand/esm';
import {
    ControllerSlice,
    InternalSlice,
    PlayerSlice,
    SentenceSlice,
    SubtitleSlice
} from './SliceTypes';
import SubtitleAdjustmentTypeConverter from '../../../common/types/SubtitleAdjustmentTypeConverter';
import useFile from '../useFile';
import usePlayerToaster from '@/fronted/hooks/usePlayerToaster';
import { strBlank } from '@/common/utils/Util';
import { SWR_KEY, swrMutate } from '@/fronted/lib/swr-util';

const api = window.electron;
const createSentenceSlice: StateCreator<
    PlayerSlice &
    SentenceSlice &
    InternalSlice &
    SubtitleSlice &
    ControllerSlice,
    [],
    [],
    SentenceSlice
> = (set, get) => ({
    currentSentence: undefined,
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

    adjustStart: async (time) => {
        const clone = get().currentSentence?.clone();
        if (!clone) {
            return;
        }
        if (clone.originalBegin === null) {
            clone.originalBegin = clone.currentBegin;
        }
        clone.currentBegin = (clone.currentBegin ?? 0) + time;
        // abs < 50
        if (
            Math.abs((clone.currentBegin ?? 0) - (clone.originalBegin ?? 0)) <
            0.05
        ) {
            clone.currentBegin = clone.originalBegin;
            clone.originalBegin = null;
        }
        get().mergeSubtitle([clone]);
        set({
            currentSentence: clone
        });
        get().repeat();
        const { subtitlePath } = useFile.getState();
        if (strBlank(subtitlePath)) {
            return;
        }
        const timeDiff = (clone.originalBegin ? clone.currentBegin - clone.originalBegin : 0);
        const timeDiffStr = timeDiff > 0 ? `+${timeDiff.toFixed(2)}` : timeDiff.toFixed(2);
        usePlayerToaster.getState()
            .setNotification({ type: 'info', text: `start: ${timeDiffStr} s` });
        await api.call('subtitle-timestamp/update',
            SubtitleAdjustmentTypeConverter.fromSentence(clone, subtitlePath)
        );
    },
    adjustEnd: async (time) => {
        const clone = get().currentSentence?.clone();
        if (!clone) {
            return;
        }
        if (clone.originalEnd === null) {
            clone.originalEnd = clone.currentEnd;
        }
        clone.currentEnd = (clone.currentEnd ?? 0) + time;
        // abs < 50
        if (
            Math.abs((clone.currentEnd ?? 0) - (clone.originalEnd ?? 0)) < 0.05
        ) {
            clone.currentEnd = clone.originalEnd;
            clone.originalEnd = null;
        }
        get().mergeSubtitle([clone]);
        set({
            currentSentence: clone
        });
        get().repeat();
        const { subtitlePath } = useFile.getState();
        if (strBlank(subtitlePath)) {
            return;
        }
        const timeDiff = (clone.originalEnd ? clone.currentEnd - clone.originalEnd : 0);
        const timeDiffStr = timeDiff > 0 ? `+${timeDiff.toFixed(2)}` : timeDiff.toFixed(2);
        usePlayerToaster.getState()
            .setNotification({ type: 'info', text: `end: ${timeDiffStr} s` });
        await api.call('subtitle-timestamp/update',
            SubtitleAdjustmentTypeConverter.fromSentence(clone, subtitlePath)
        );
    },

    clearAdjust: () => {
        const clone = get().currentSentence?.clone();
        if (!clone) {
            return;
        }
        if (clone.originalBegin !== null) {
            clone.currentBegin = clone.originalBegin;
            clone.originalBegin = null;
        }
        if (clone.originalEnd !== null) {
            clone.currentEnd = clone.originalEnd;
            clone.originalEnd = null;
        }
        get().mergeSubtitle([clone]);
        set({
            currentSentence: clone
        });
        get().repeat();
        const { subtitlePath } = useFile.getState();
        if (strBlank(subtitlePath)) {
            return;
        }
        api.call('subtitle-timestamp/delete/by-key', clone.key);
    }
});

export const sentenceClearAllAdjust = async () => {
    await api.call('subtitle-timestamp/delete/by-file-hash',
        useFile.getState().srtHash
    );
    useFile.setState({
        subtitlePath: null
    });
    swrMutate(SWR_KEY.PLAYER_P).then();
};

export default createSentenceSlice;
