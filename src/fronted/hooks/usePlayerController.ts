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
    SubtitleSlice
} from './usePlayerControllerSlices/SliceTypes';
import createPlayerSlice from './usePlayerControllerSlices/createPlayerSlice';
import createSentenceSlice from './usePlayerControllerSlices/createSentenceSlice';
import createInternalSlice from './usePlayerControllerSlices/createInternalSlice';
import createModeSlice from './usePlayerControllerSlices/createModeSlice';
import createControllerSlice from './usePlayerControllerSlices/createControllerSlice';
import { Sentence, SrtSentence } from '@/common/types/SentenceC';
import useFile from './useFile';
import { sleep } from '@/common/utils/Util';
import useSetting from './useSetting';
import TransHolder from '../../common/utils/TransHolder';
import { SWR_KEY, swrMutate } from '@/fronted/lib/swr-util';
import useFavouriteClip from '@/fronted/hooks/useFavouriteClip';
import StrUtil from '@/common/utils/str-util';
import { ObjUtil } from '@/backend/utils/ObjUtil';

const api = window.electron;
const usePlayerController = create<
    PlayerSlice &
    SentenceSlice &
    ModeSlice &
    InternalSlice &
    SubtitleSlice &
    ControllerSlice
    // WordLevelSlice
>()(
    subscribeWithSelector((...a) => ({
        ...createPlayerSlice(...a),
        ...createSentenceSlice(...a),
        ...createModeSlice(...a),
        ...createInternalSlice(...a),
        ...createSubtitleSlice(...a),
        ...createControllerSlice(...a)
        // ...createWordLevelSlice(...a),
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
                    playTime: state.internal.exactPlayTime
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
        duration: state.duration
    }),
    async ({ playTime, duration }) => {
        if (useFile.getState().videoLoaded) {
            count += 1;
            if (count % 5 !== 0) {
                return;
            }
            const file = useFile.getState().videoId;
            if (!file) {
                return;
            }

            await api.call('watch-project/progress/update', {
                videoId: file,
                currentTime: playTime,
                duration
            });
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
        playing: state.playing
    }),
    async ({ playing }) => {
        if (!playing) {
            const state = usePlayerController.getState();
            const srtTender = state.srtTender;
            if (state.autoPause || state.singleRepeat || !srtTender) {
                return;
            }
            updateSentenceInterval = window.setInterval(() => {
                if (useFile.getState().videoLoaded) {
                    const currentTime = state.internal.exactPlayTime;
                    const nextSentence: Sentence = srtTender.getByTime(currentTime);
                    const cs: Sentence | undefined = state.currentSentence;
                    const isCurrent = cs === nextSentence;
                    if (isCurrent) {
                        return;
                    }
                    usePlayerController.setState({ currentSentence: nextSentence });
                }
            }, 1000);
        } else if (updateSentenceInterval) {
            window.clearInterval(updateSentenceInterval);
            updateSentenceInterval = null;
        }
    },
    { equalityFn: shallow }
);

/**
 *
 */

function filterUserCanSee(finishedGroup: Set<number>, subtitle: Sentence[]) {
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

/**
 * 加载与翻译
 */
useFile.subscribe(
    (s) => s.subtitlePath,
    async (subtitlePath) => {
        if (StrUtil.isBlank(subtitlePath)) {
            return;
        }
        const CURRENT_FILE = useFile.getState().subtitlePath;
        const srtSubtitles: SrtSentence | null = await api.call('subtitle/srt/parse-to-sentences', subtitlePath);
        if (ObjUtil.isNull(srtSubtitles)) {
            if (CURRENT_FILE !== useFile.getState().subtitlePath) {
                return;
            }
            useFile.setState({
                subtitlePath: null
            });
            usePlayerController.getState().setSubtitle([]);
            return;
        }
        const subtitle = srtSubtitles.sentences;
        if (CURRENT_FILE !== useFile.getState().subtitlePath) {
            return;
        }
        usePlayerController.getState().setSubtitle(subtitle);
        useFile.setState({
            srtHash: srtSubtitles.fileHash
        });
        const finishedGroup = new Set<number>();
        while (CURRENT_FILE === useFile.getState().subtitlePath) {
            const userCanSee = filterUserCanSee(finishedGroup, subtitle);
            // console.log('userCanSee', userCanSee);
            if (userCanSee.length > 0) {
                console.log('test error before');
                const transHolder = TransHolder.from(
                    // eslint-disable-next-line no-await-in-loop
                    await api.call('ai-trans/batch-translate',
                        userCanSee.map((s) => s.text ?? '')
                    )
                );
                console.log('test error after');
                if (CURRENT_FILE !== useFile.getState().subtitlePath) {
                    return;
                }
                console.log('transHolder', transHolder);
                if (!transHolder.isEmpty()) {
                    usePlayerController
                        .getState()
                        .mergeSubtitleTrans(transHolder);
                }
                // 加载收藏
                useFavouriteClip.getState().updateClipInfo(srtSubtitles.fileHash, userCanSee.map((s) => s.index));
            }
            await sleep(500);
        }
    }
);

/**
 * 监听腾讯密钥更新
 */
useSetting.subscribe(
    (s) =>
        `${s.setting('apiKeys.tencent.secretId')}:${s.setting(
            'apiKeys.tencent.secretKey'
        )}`,
    (s, ps) => {
        useFile.setState({
            subtitlePath: null
        });
        swrMutate(SWR_KEY.PLAYER_P).then();
    }
);
