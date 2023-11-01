import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { shallow } from 'zustand/shallow';
import createSubtitleSlice from './usePlayerControllerSlices/createSubtitleSlice';
import {
    ControllerSlice,
    InternalSlice,
    ModeSlice,
    PlayerSlice,
    SentenceSlice,
    SubtitleSlice,
    WordLevelSlice,
} from './usePlayerControllerSlices/SliceTypes';
import createPlayerSlice from './usePlayerControllerSlices/createPlayerSlice';
import createSentenceSlice from './usePlayerControllerSlices/createSentenceSlice';
import createInternalSlice from './usePlayerControllerSlices/createInternalSlice';
import createModeSlice from './usePlayerControllerSlices/createModeSlice';
import createControllerSlice from './usePlayerControllerSlices/createControllerSlice';
import FileT from '../lib/param/FileT';
import parseSrtSubtitles from '../lib/parseSrt';
import SentenceT from '../lib/param/SentenceT';
import useFile from './useFile';
import { sleep, splitToWords } from '../../utils/Util';
import useSetting from './useSetting';
import { ProgressParam } from '../../main/controllers/ProgressController';
import createWordLevelSlice from './usePlayerControllerSlices/createWordLevelSlice';
import TransHolder from '../../utils/TransHolder';

const api = window.electron;
const usePlayerController = create<
    PlayerSlice &
        SentenceSlice &
        ModeSlice &
        InternalSlice &
        SubtitleSlice &
        ControllerSlice &
        WordLevelSlice
>()(
    subscribeWithSelector((...a) => ({
        ...createPlayerSlice(...a),
        ...createSentenceSlice(...a),
        ...createModeSlice(...a),
        ...createInternalSlice(...a),
        ...createSubtitleSlice(...a),
        ...createControllerSlice(...a),
        ...createWordLevelSlice(...a),
    }))
);
export default usePlayerController;

let interval: number | null = null;

/**
 * 同步 exactPlayTime 到 playTime
 */
usePlayerController.subscribe(
    (state) => state.playing,
    (playing) => {
        if (playing) {
            const sync = () => {
                usePlayerController.setState((state) => ({
                    playTime: state.internal.exactPlayTime,
                }));
            };
            sync();
            interval = window.setInterval(sync, 300);
        } else if (interval) {
            window.clearInterval(interval);
            interval = null;
        }
    }
);

/**
 * 同步播放时间到后台
 */
let count = 0;
usePlayerController.subscribe(
    (state) => ({
        playTime: state.playTime,
        duration: state.duration,
    }),
    async ({ playTime, duration }) => {
        if (useFile.getState().videoLoaded) {
            count += 1;
            if (count % 5 !== 0) {
                return;
            }
            const file = useFile.getState();
            const p: ProgressParam = {
                fileName: file.videoFile?.fileName ?? '',
                progress: playTime,
                total: duration,
                filePath: file.videoFile?.path ?? '',
                subtitlePath: file.subtitleFile?.path,
            };
            await api.updateProgress(p);
        }
    },
    { equalityFn: shallow }
);

/**
 * 视频暂停时也尝试更新当前句子
 */
let updateSentenceInterval: number | null = null;
usePlayerController.subscribe(
    (state) => ({
        playing: state.playing,
    }),
    async ({ playing }) => {
        if (!playing) {
            updateSentenceInterval = window.setInterval(() => {
                if (useFile.getState().videoLoaded) {
                    usePlayerController.getState().tryUpdateCurrentSentence();
                }
            }, 1000);
        } else if (updateSentenceInterval) {
            window.clearInterval(updateSentenceInterval);
            updateSentenceInterval = null;
        }
    },
    { equalityFn: shallow }
);

async function loadSubtitle(subtitleFile: FileT) {
    const url = subtitleFile?.objectUrl ?? '';

    const text = await fetch(url).then((res) => res.text());

    const srtSubtitles = parseSrtSubtitles(text);
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

function filterUserCanSee(finishedGroup: Set<number>, subtitle: SentenceT[]) {
    const currentGroup =
        usePlayerController.getState().currentSentence?.transGroup ?? 1;
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
    return groupSubtitles;
}

async function syncWordsLevel(userCanSee: SentenceT[]) {
    if (userCanSee.length === 0) {
        return;
    }
    const words = new Set<string>();
    userCanSee.forEach((item) => {
        splitToWords(item.text).forEach((w) => {
            words.add(w);
        });
    });
    await usePlayerController.getState().syncWordsLevel(Array.from(words));
}

/**
 * 加载与翻译
 */
useFile.subscribe(
    (s) => s.subtitleFile,
    async (subtitleFile) => {
        if (subtitleFile === undefined) {
            return;
        }
        const CURRENT_FILE = useFile.getState().subtitleFile;
        const subtitle: SentenceT[] = await loadSubtitle(subtitleFile);
        groupSentence(subtitle, 20, (s, index) => {
            s.transGroup = index;
        });
        if (CURRENT_FILE !== useFile.getState().subtitleFile) {
            return;
        }
        usePlayerController.getState().setSubtitle(subtitle);
        usePlayerController.getState().internal.wordLevel = new Map();
        const finishedGroup = new Set<number>();
        let inited = false;
        while (CURRENT_FILE === useFile.getState().subtitleFile) {
            if (inited) {
                // eslint-disable-next-line no-await-in-loop
                await sleep(500);
            }
            inited = true;
            // eslint-disable-next-line no-await-in-loop
            const userCanSee = filterUserCanSee(finishedGroup, subtitle);
            if (userCanSee.length > 0) {
                // eslint-disable-next-line no-await-in-loop
                await syncWordsLevel(userCanSee);
                const transHolder = TransHolder.from(
                    // eslint-disable-next-line no-await-in-loop
                    await api.batchTranslate(
                        userCanSee.map((s) => s.text ?? '')
                    )
                );
                if (CURRENT_FILE !== useFile.getState().subtitleFile) {
                    return;
                }
                console.log('transHolder', transHolder);
                if (!transHolder.isEmpty()) {
                    usePlayerController
                        .getState()
                        .mergeSubtitleTrans(transHolder);
                }
            }
        }
    }
);

/**
 * 监听腾讯密钥更新
 */
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
