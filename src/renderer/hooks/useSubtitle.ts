import axios from 'axios';
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import FileT from '../lib/param/FileT';
import SentenceT from '../lib/param/SentenceT';
import parseSrtSubtitles from '../lib/parseSrt';
import TranslateBuf from '../lib/TranslateBuf';
import TransFiller from '../lib/TransFiller';
import useFile from './useFile';
import useCurrentSentence from './useCurrentSentence';
import useSetting from './useSetting';

const api = window.electron;
const GROUP_SECONDS = 30;
type UseSubtitleState = {
    internal: {
        // SentenceT[] 的数组
        subtitleIndex: Map<number, SentenceT[]>;
    };
    subtitle: SentenceT[];
};

useSetting.subscribe(
    (s) => s.tencentSecret,
    (s, ps) => {
        if (JSON.stringify(s) === JSON.stringify(ps)) {
            return;
        }
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
);

type UseSubtitleActions = {
    setSubtitle: (subtitle: SentenceT[]) => void;
    mergeSubtitle: (subtitle: SentenceT[]) => void;
    getSubtitleAt: (time: number) => SentenceT | undefined;
};

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

const useSubtitle = create(
    subscribeWithSelector<UseSubtitleState & UseSubtitleActions>(
        (set, get) => ({
            internal: {
                subtitleIndex: new Map(),
            },
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
                const group =
                    get().internal.subtitleIndex.get(groupIndex) ?? [];
                const eleIndex =
                    group.find((e) => e.isCurrent(time))?.index ?? 0;
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
        })
    )
);

export interface SentenceApiParam {
    index: number;
    text: string;
    translate: string | undefined;
}

export const toSentenceApiParam = (sentence: SentenceT): SentenceApiParam => {
    return {
        index: sentence.index,
        text: sentence.text ?? '',
        translate: undefined,
    };
};
async function loadSubtitle(subtitleFile: FileT) {
    const url = subtitleFile?.objectUrl ?? '';

    const axiosResponse = await axios.get(url);

    const str = axiosResponse.data;

    const srtSubtitles = parseSrtSubtitles(str);
    srtSubtitles.forEach((item) => {
        item.fileUrl = url;
        item.setKey();
    });
    return srtSubtitles;
}
function groupSentence(
    subtitle: SentenceT[],
    batch: number,
    fieldConsumer: (s: SentenceT, index: number) => void
) {
    const groups: SentenceT[][] = [];
    let group: SentenceT[] = [];
    subtitle.forEach((item) => {
        group.push(item);
        if (group.length >= batch) {
            groups.push(group);
            group = [];
        }
    });
    if (group.length > 0) {
        groups.push(group);
    }
    groups.forEach((item, index) => {
        item.forEach((s) => {
            fieldConsumer(s, index);
        });
    });
}

function merge(baseArr: SentenceT[], diff: SentenceApiParam[]) {
    const mapping = new Map<number, string>();
    diff.forEach((item) => {
        mapping.set(item.index, item.translate ?? '');
    });
    return baseArr.map((item) => {
        const translate = mapping.get(item.index);
        if (translate) {
            const ns = item.clone();
            ns.msTranslate = translate;
            return ns;
        }
        return item;
    });
}
const trans = async (sentence: SentenceT[]): Promise<SentenceT[]> => {
    if (sentence.length === 0) {
        return [];
    }
    const params = sentence.map(toSentenceApiParam);
    const cacheRes = await api.loadTransCache(params);
    let res = merge(sentence, cacheRes);
    const remain = res.filter(
        (item) => item.msTranslate === '' || item.msTranslate === undefined
    );
    const buffers: TranslateBuf[] = TransFiller.splitToBuffers(remain, 1000);

    // eslint-disable-next-line no-restricted-syntax
    // for (const buffer of buffers) {
    for (let i = 0; i < buffers.length; i += 1) {
        const buffer = buffers[i];
        if (buffer.isEmpty()) {
            // eslint-disable-next-line no-continue
            continue;
        }
        // eslint-disable-next-line no-await-in-loop
        const currentDiff = await api.batchTranslate(buffer.sentences);
        res = merge(res, currentDiff);
        if (i < buffers.length - 1) {
            // eslint-disable-next-line no-await-in-loop
            await TransFiller.sleep(300);
        }
    }
    return res;
};

const transUserCanSee = async (
    subtitle: SentenceT[],
    finishedGroup: Set<number>
): Promise<SentenceT[]> => {
    const currentGroup =
        useCurrentSentence.getState().currentSentence?.transGroup ?? 1;
    let shouldTransGroup = [currentGroup - 1, currentGroup, currentGroup + 1];
    shouldTransGroup = shouldTransGroup.filter(
        (item) => !finishedGroup.has(item)
    );
    if (shouldTransGroup.length === 0) {
        // eslint-disable-next-line no-continue
        return [];
    }
    console.log('trans group', shouldTransGroup);
    const groupSubtitles = subtitle.filter((item) =>
        shouldTransGroup.includes(item.transGroup)
    );
    shouldTransGroup.forEach((item) => {
        finishedGroup.add(item);
    });
    // eslint-disable-next-line no-await-in-loop
    return trans(groupSubtitles);
};
useFile.subscribe(
    (s) => s.subtitleFile,
    async (subtitleFile) => {
        if (subtitleFile === undefined) {
            return;
        }
        const CURRENT_FILE = useFile.getState().subtitleFile;
        const subtitle: SentenceT[] = await loadSubtitle(subtitleFile);
        groupSentence(subtitle, 25, (s, index) => {
            s.transGroup = index;
        });
        if (CURRENT_FILE !== useFile.getState().subtitleFile) {
            return;
        }
        useSubtitle.getState().setSubtitle(subtitle);
        const finishedGroup = new Set<number>();
        let inited = false;
        while (CURRENT_FILE === useFile.getState().subtitleFile) {
            if (inited) {
                // eslint-disable-next-line no-await-in-loop
                await TransFiller.sleep(500);
            }
            inited = true;
            // eslint-disable-next-line no-await-in-loop
            const seePart = await transUserCanSee(subtitle, finishedGroup);

            if (CURRENT_FILE !== useFile.getState().subtitleFile) {
                return;
            }
            if (seePart.length > 0) {
                useSubtitle.getState().mergeSubtitle(seePart);
            }
        }
    }
);

export default useSubtitle;
