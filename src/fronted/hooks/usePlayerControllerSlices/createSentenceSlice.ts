import { StateCreator } from 'zustand/esm';
import {
    ControllerSlice,
    InternalSlice,
    PlayerSlice,
    SentenceSlice,
    SubtitleSlice
} from './SliceTypes';
import useFile from '../useFile';
import usePlayerToaster from '@/fronted/hooks/usePlayerToaster';
import StrUtil from '@/common/utils/str-util';
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

    adjustStart: async (time) => {
        const cs = get().currentSentence;
        const srtTender = get().srtTender;
        if (!cs || !srtTender) {
            return;
        }
        const clone = srtTender.adjustBegin(cs, time);
        get().mergeSubtitle([clone]);
        set({ currentSentence: clone });
        get().repeat();
        const { subtitlePath } = useFile.getState();
        if (StrUtil.isBlank(subtitlePath)) {
            return;
        }
        const timeDiff = srtTender.timeDiff(clone).start;
        const timeDiffStr = timeDiff > 0 ? `+${timeDiff.toFixed(2)}` : timeDiff.toFixed(2);
        usePlayerToaster.getState()
            .setNotification({ type: 'info', text: `start: ${timeDiffStr} s` });
        const { start, end } = srtTender.mapSeekTimeStraight(clone);
        await api.call('subtitle-timestamp/update', {
            key: clone.key,
            subtitle_path: subtitlePath,
            subtitle_hash: useFile.getState().srtHash,
            start_at: start,
            end_at: end,
        });
    },
    adjustEnd: async (time) => {
        const cs = get().currentSentence?.clone();
        const srtTender = get().srtTender;
        if (!cs || !srtTender) {
            return;
        }
        const clone = srtTender.adjustEnd(cs, time);
        get().mergeSubtitle([clone]);
        set({ currentSentence: clone });
        get().repeat();
        const { subtitlePath } = useFile.getState();
        if (StrUtil.isBlank(subtitlePath)) {
            return;
        }
        const timeDiff = srtTender.timeDiff(clone).end;
        const timeDiffStr = timeDiff > 0 ? `+${timeDiff.toFixed(2)}` : timeDiff.toFixed(2);
        usePlayerToaster.getState()
            .setNotification({ type: 'info', text: `end: ${timeDiffStr} s` });
        const { start, end } = srtTender.mapSeekTimeStraight(clone);
        await api.call('subtitle-timestamp/update', {
            key: clone.key,
            subtitle_path: subtitlePath,
            subtitle_hash: useFile.getState().srtHash,
            start_at: start,
            end_at: end
        });
    },

    clearAdjust: async () => {
        const clone = get().currentSentence?.clone();
        if (!clone) {
            return;
        }
        const srtTender = get().srtTender;
        if (!srtTender) {
            return;
        }
        srtTender.clearAdjust(clone);
        srtTender.update(clone);
        get().mergeSubtitle([clone]);
        set({
            currentSentence: clone
        });
        get().repeat();
        const { subtitlePath } = useFile.getState();
        if (StrUtil.isBlank(subtitlePath)) {
            return;
        }
        await api.call('subtitle-timestamp/delete/by-key', clone.key);
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
