import { StateCreator } from 'zustand/esm';
import { Sentence } from '@/common/types/SentenceC';
import { InternalSlice, SubtitleSlice } from './SliceTypes';
import { SrtTenderImpl } from '@/fronted/lib/SrtTender';
import { getRendererLogger } from '@/fronted/log/simple-logger';

function mergeArr(baseArr: Sentence[], diff: Sentence[]) {
    if (diff.length === 0) {
        return baseArr;
    }
    const mapping = new Map<number, Sentence>();
    diff.forEach((item) => {
        mapping.set(item.index, item);
    });
    return baseArr.map((item, index) => {
        return mapping.get(index) ?? item;
    });
}


const createSubtitleSlice: StateCreator<
    SubtitleSlice & InternalSlice,
    [],
    [],
    SubtitleSlice
> = (set, get) => ({
    subtitle: [],
    srtTender: null,
    subTitlesStructure: new Map(),
    setSubtitle: (subtitle: Sentence[]) => {
        const srtTender = new SrtTenderImpl(subtitle);
        set({ subtitle, srtTender });
    },
    mergeSubtitle: (diff: Sentence[]) => {
        const newSubtitle = mergeArr(get().subtitle, diff);
        set({ subtitle: newSubtitle });
        const srtTender = get().srtTender;
        if (!srtTender)  {
            getRendererLogger('createSubtitleSlice').error('srtTender is null');
            return;
        }
        diff.forEach((item) => {
            srtTender.update(item);
        });
    },
    getSubtitleAround: (index: number, num = 5) => {
        const min = Math.max(index - num, 0);
        const max = Math.min(index + num, get().subtitle.length - 1);
        const result = [];
        for (let i = min; i <= max; i += 1) {
            result.push(get().subtitle[i]);
        }
        return result;
    }
});
export default createSubtitleSlice;
