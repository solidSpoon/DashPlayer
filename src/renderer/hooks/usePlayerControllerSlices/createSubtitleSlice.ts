import { StateCreator } from 'zustand/esm';
import SentenceT from '../../lib/param/SentenceT';
import { InternalSlice, SubtitleSlice } from './SliceTypes';

const GROUP_SECONDS = 30;

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
    setSubtitle: (subtitle: SentenceT[]) => {
        set({ subtitle });
        get().internal.subtitleIndex = indexSubtitle(subtitle);
    },
    mergeSubtitle: (diff: SentenceT[]) => {
        const newSubtitle = mergeArr(get().subtitle, diff);
        set({ subtitle: newSubtitle });
        get().internal.subtitleIndex = indexSubtitle(newSubtitle);
    },
    getSubtitleAt: (time: number) => {
        const groupIndex = Math.floor(time / GROUP_SECONDS);
        const group = get().internal.subtitleIndex.get(groupIndex) ?? [];
        const eleIndex = group.find((e) => e.isCurrent(time))?.index ?? 0;
        const sentenceT = get().subtitle[eleIndex];
        console.log(
            'getSubtitleAt',
            groupIndex,
            eleIndex,
            group.length,
            time,
            sentenceT?.currentBegin,
            sentenceT?.currentEnd,
            sentenceT?.nextBegin
        );
        return sentenceT;
    },
});
export default createSubtitleSlice;
