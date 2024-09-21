import { StateCreator } from 'zustand/esm';
import SentenceC from '../../../common/types/SentenceC';
import { InternalSlice, SubtitleSlice } from './SliceTypes';
import { SrtTenderImpl } from '@/fronted/lib/SrtTender';

function mergeArr(baseArr: SentenceC[], diff: SentenceC[]) {
    if (diff.length === 0) {
        return baseArr;
    }
    const mapping = new Map<number, SentenceC>();
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
    setSubtitle: (subtitle: SentenceC[]) => {
        const srtTender = new SrtTenderImpl(subtitle);
        set({ subtitle, srtTender });
    },
    mergeSubtitle: (diff: SentenceC[]) => {
        const newSubtitle = mergeArr(get().subtitle, diff);
        set({ subtitle: newSubtitle });
        const srtTender = get().srtTender;
        diff.forEach((item) => {
            srtTender.update(item);
        });
    },
    mergeSubtitleTrans: (holder) => {
        const subtitle = get().subtitle.map((s) => {
            const trans = holder.get(s.text ?? '');
            if (!trans) {
                return s;
            }
            const ns = s.clone();
            ns.msTranslate = trans;
            return ns;
        });
        set({ subtitle });
        const srtTender = get().srtTender;
        subtitle.forEach((item) => {
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
