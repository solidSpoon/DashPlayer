import { StateCreator } from 'zustand/esm';
import SentenceT from '../../lib/param/SentenceT';
import { InternalSlice, SubtitleSlice } from './SliceTypes';

const GROUP_SECONDS = 10;

function mergeArr(baseArr: SentenceT[], diff: SentenceT[]) {
    if (diff.length === 0) {
        return baseArr;
    }
    const mapping = new Map<number, SentenceT>();
    diff.forEach((item) => {
        mapping.set(item.index, item);
    });
    return baseArr.map((item, index) => {
        return mapping.get(index) ?? item;
    });
}

function indexSubtitle(sentences: SentenceT[]) {
    const map = new Map<number, SentenceT[]>();
    sentences.forEach((item) => {
        const minIndex = Math.floor(
            Math.min(
                item.currentBegin ?? 0,
                item.currentEnd ?? 0,
                item.nextBegin ?? 0
            ) / GROUP_SECONDS
        );
        const maxIndex = Math.floor(
            Math.max(
                item.currentBegin ?? 0,
                item.currentEnd ?? 0,
                item.nextBegin ?? 0
            ) / GROUP_SECONDS
        );
        for (let i = minIndex; i <= maxIndex; i += 1) {
            const group = map.get(i) ?? [];
            group.push(item);
            map.set(i, group);
        }
    });
    return map;
}

const createSubtitleSlice: StateCreator<
    SubtitleSlice & InternalSlice,
    [],
    [],
    SubtitleSlice
> = (set, get) => ({
    subtitle: [],
    subTitlesStructure: new Map(),
    setSubtitle: (subtitle: SentenceT[]) => {
        set({ subtitle });
        get().internal.subtitleIndex = indexSubtitle(subtitle);
        get().internal.maxIndex = Math.max(
            ...Array.from(get().internal.subtitleIndex.keys())
        );
    },
    mergeSubtitle: (diff: SentenceT[]) => {
        const newSubtitle = mergeArr(get().subtitle, diff);
        set({ subtitle: newSubtitle });
        get().internal.subtitleIndex = indexSubtitle(newSubtitle);
        get().internal.maxIndex = Math.max(
            ...Array.from(get().internal.subtitleIndex.keys())
        );
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
        get().internal.subtitleIndex = indexSubtitle(subtitle);
        get().internal.maxIndex = Math.max(
            ...Array.from(get().internal.subtitleIndex.keys())
        );
    },
    getSubtitleAt: (time: number) => {
        const groupIndex = Math.floor(time / GROUP_SECONDS);
        const group = get().internal.subtitleIndex.get(groupIndex) ?? [];
        const eleIndex = group.find((e) => e.isCurrent(time))?.index;
        if (eleIndex === undefined) {
            return undefined;
        }
        return get().subtitle[eleIndex];
    },
});
export default createSubtitleSlice;
