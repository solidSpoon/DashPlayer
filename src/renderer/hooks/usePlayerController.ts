import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import axios from 'axios';
import { shallow } from 'zustand/shallow';
import createSubtitleSlice from './usePlayerControllerSlices/createSubtitleSlice';
import {
    ControllerSlice,
    InternalSlice,
    ModeSlice,
    PlayerSlice,
    SentenceSlice,
    SubtitleSlice,
} from './usePlayerControllerSlices/SliceTypes';
import createPlayerSlice from './usePlayerControllerSlices/createPlayerSlice';
import createSentenceSlice from './usePlayerControllerSlices/createSentenceSlice';
import createInternalSlice from './usePlayerControllerSlices/createInternalSlice';
import createModeSlice from './usePlayerControllerSlices/createModeSlice';
import createControllerSlice from './usePlayerControllerSlices/createControllerSlice';
import FileT from '../lib/param/FileT';
import parseSrtSubtitles from '../lib/parseSrt';
import SentenceT from '../lib/param/SentenceT';
import translate from '../lib/TranslateBuf';
import useFile from './useFile';
import { sleep } from '../../utils/Util';
import useSetting from './useSetting';
import { ProgressParam } from '../../main/controllers/ProgressController';

const api = window.electron;
const usePlayerController = create<
    PlayerSlice &
        SentenceSlice &
        ModeSlice &
        InternalSlice &
        SubtitleSlice &
        ControllerSlice
>()(
    subscribeWithSelector((...a) => ({
        ...createPlayerSlice(...a),
        ...createSentenceSlice(...a),
        ...createModeSlice(...a),
        ...createInternalSlice(...a),
        ...createSubtitleSlice(...a),
        ...createControllerSlice(...a),
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
const transUserCanSee = async (
    subtitle: SentenceT[],
    finishedGroup: Set<number>
): Promise<SentenceT[]> => {
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
    // eslint-disable-next-line no-await-in-loop
    return translate(groupSubtitles);
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
        usePlayerController.getState().setSubtitle(subtitle);
        const finishedGroup = new Set<number>();
        let inited = false;
        while (CURRENT_FILE === useFile.getState().subtitleFile) {
            if (inited) {
                // eslint-disable-next-line no-await-in-loop
                await sleep(500);
            }
            inited = true;
            // eslint-disable-next-line no-await-in-loop
            const seePart = await transUserCanSee(subtitle, finishedGroup);

            if (CURRENT_FILE !== useFile.getState().subtitleFile) {
                return;
            }
            if (seePart.length > 0) {
                usePlayerController.getState().mergeSubtitle(seePart);
            }
        }
    }
);

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
