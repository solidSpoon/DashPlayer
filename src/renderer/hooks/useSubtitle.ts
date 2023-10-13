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

const api = window.electron;

//    useEffect(() => {
//         const cancel = api.onTencentSecretUpdate(() =>
//             setSecretVersion((v) => v + 1)
//         );
//         return () => {
//             cancel();
//         };
//     });

type UseSubtitleState = {
    subtitle: SentenceT[];
};

api.onTencentSecretUpdate(() => {
    useFile.setState((state) => {
        return {
            subtitleFile: state.subtitleFile
                ? {
                      ...state.subtitleFile,
                  }
                : undefined,
        };
    });
});

type UseSubtitleActions = {
    setSubtitle: (subtitle: SentenceT[]) => void;
    mergeSubtitle: (subtitle: SentenceT[]) => void;
};
const useSubtitle = create(
    subscribeWithSelector<UseSubtitleState & UseSubtitleActions>(
        (set, get) => ({
            subtitle: [],
            setSubtitle: (subtitle: SentenceT[]) => {
                set({ subtitle });
            },
            mergeSubtitle: (diff: SentenceT[]) => {
                const mapping = new Map<number, SentenceT>();
                diff.forEach((item) => {
                    mapping.set(item.index, item);
                });
                const baseArr = get().subtitle;
                const newSubtitle = baseArr.map((item, index) => {
                    return mapping.get(index) ?? item;
                });
                console.log('abc mergeSubtitle', newSubtitle);
                set({ subtitle: newSubtitle });
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

function groupForTranslate(subtitle: SentenceT[], batch: number) {
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
            s.transGroup = index;
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

useFile.subscribe(
    (s) => s.subtitleFile,
    async (subtitleFile) => {
        if (subtitleFile === undefined) {
            return;
        }
        const CURRENT_FILE = useFile.getState().subtitleFile;
        const subtitle: SentenceT[] = await loadSubtitle(subtitleFile);
        groupForTranslate(subtitle, 25);
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
            const currentGroup =
                useCurrentSentence.getState().currentSentence?.transGroup ?? 1;
            let shouldTransGroup = [
                currentGroup - 1,
                currentGroup,
                currentGroup + 1,
            ];
            shouldTransGroup = shouldTransGroup.filter(
                (item) => !finishedGroup.has(item)
            );
            if (shouldTransGroup.length === 0) {
                // eslint-disable-next-line no-continue
                continue;
            }
            console.log('trans group', shouldTransGroup);
            const groupSubtitles = subtitle.filter((item) =>
                shouldTransGroup.includes(item.transGroup)
            );
            // eslint-disable-next-line no-await-in-loop
            const res = await trans(groupSubtitles);
            if (CURRENT_FILE !== useFile.getState().subtitleFile) {
                break;
            }
            useSubtitle.getState().mergeSubtitle(res);
            shouldTransGroup.forEach((item) => {
                finishedGroup.add(item);
            });
        }
    }
);

export default useSubtitle;
