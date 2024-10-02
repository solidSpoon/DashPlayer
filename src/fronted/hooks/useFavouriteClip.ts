import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { ClipMeta } from '@/common/types/OssObject';
import useFile from '@/fronted/hooks/useFile';
import usePlayerController from '@/fronted/hooks/usePlayerController';
import { swrApiMutate } from '@/fronted/lib/swr-util';
import { Nullable } from '@/common/types/Types';
import StrUtil from '@/common/utils/str-util';
import { SrtSentence } from '@/common/types/SentenceC';
import { ObjUtil } from '@/backend/utils/ObjUtil';
import TransHolder from '@/common/utils/TransHolder';
import { sleep } from '@/common/utils/Util';
import { SrtTender } from '@/fronted/lib/SrtTender';

const api = window.electron;

export interface PlayInfo {
    video: ClipMeta;
    /**
     * 从 0 开始的时间
     */
    time: number;
    timeUpdated: number;
}

type UseFavouriteClipState = {
    playInfo: PlayInfo | null;
    currentTime: number;
    srtTender: SrtTender | null;
    lineClip: Map<string, boolean>;
    transMap: TransHolder<string>;
};
type UseFavouriteClipActions = {
    setPlayInfo: (playInfo: PlayInfo | null) => void;
    setCurrentTime: (currentTime: number) => void;
    changeCurrentLineClip: () => void;
    updateClipInfo: (srtKey: string, indexesInSrt: number[]) => Promise<void>;
    deleteClip: (key: string) => void;
};

export const mapClipKey = (srtKey: Nullable<string>, indexInSrt: number) => `${srtKey}::=::${indexInSrt}`;

const useFavouriteClip = create(
    subscribeWithSelector<UseFavouriteClipState & UseFavouriteClipActions>((set, get) => ({
        playInfo: null,
        currentTime: 0,
        lineClip: new Map(),
        transMap: TransHolder.from(new Map()),
        setPlayInfo: (playInfo: PlayInfo | null) => {
            set({ playInfo });
        },
        setCurrentTime: (currentTime: number) => {
            set({ currentTime });
        },
        changeCurrentLineClip: async () => {
            const videoPath = useFile.getState().videoPath;
            const srtHash = useFile.getState().srtHash;
            const currentSentence = usePlayerController.getState().currentSentence;
            if (!videoPath || !srtHash || !currentSentence) {
                return;
            }
            const key = mapClipKey(srtHash, currentSentence.index);
            let exists = get().lineClip.get(key);
            if (exists === undefined) {
                exists = await api.call('favorite-clips/exists', {
                    srtKey: srtHash,
                    linesInSrt: [currentSentence.index]
                }).then((map) => map.get(currentSentence.index) ?? false);
            }
            set((state) => {
                const lineClip = new Map(state.lineClip);
                lineClip.set(key, !exists);
                return { lineClip };
            });
            if (exists) {
                await api.call('favorite-clips/cancel-add', { srtKey: srtHash, indexInSrt: currentSentence?.index });
            } else {
                await api.call('favorite-clips/add', {
                    videoPath,
                    srtKey: srtHash,
                    indexInSrt: currentSentence?.index
                });
            }
        },
        updateClipInfo: async (srtKey: string, indexesInSrt: number[]) => {
            const mapping = await api.call('favorite-clips/exists', { srtKey, linesInSrt: indexesInSrt });
            set((state) => {
                const lineClip = new Map(state.lineClip);
                for (const [indexInSrt, exists] of mapping) {
                    const key = mapClipKey(srtKey, indexInSrt);
                    lineClip.set(key, exists);
                }
                return { lineClip };
            });
        },
        deleteClip: async (key: string) => {
            await api.call('favorite-clips/delete', key);
            await swrApiMutate('favorite-clips/search');
            useFile.setState({
                subtitlePath: null
            });
            set((state) => {
                const lineClip = new Map(state.lineClip);
                lineClip.set(key, false);
                return { lineClip };
            });
        }
    }))
);

/**
 * 加载与翻译
 */
useFavouriteClip.subscribe(
    (s) => s.playInfo?.video.clip_content,
    async (clipContent) => {
        if (!clipContent) {
            return;
        }
        console.log('clipContent trans', clipContent);
        const currentHolder = useFavouriteClip.getState().transMap;
        const param = clipContent
            .filter((s) => StrUtil.isNotBlank(s.contentEn))
            .filter((s) => !currentHolder.get(s.contentEn))
            .map((s) => s.contentEn);
        console.log('clipContent trans', param);
        const transHolder = TransHolder.from(
            await api.call('ai-trans/batch-translate',
                param
            )
        );
        useFavouriteClip.setState({
            transMap: transHolder.merge(currentHolder)
        });
    }
);

export default useFavouriteClip;
