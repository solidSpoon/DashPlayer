import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { OssObject } from '@/common/types/OssObject';
import useFile from '@/fronted/hooks/useFile';
import usePlayerController from '@/fronted/hooks/usePlayerController';
const api = window.electron;

export interface PlayInfo {
    video: OssObject;
    /**
     * 从 0 开始的时间
     */
    time: number;
    timeUpdated: number;
}

type UseFavouriteClipState = {
    playInfo: PlayInfo | null;
    currentTime: number;
    lineClip: Map<string, boolean>;
};
type UseFavouriteClipActions = {
    setPlayInfo: (playInfo: PlayInfo | null) => void;
    setCurrentTime: (currentTime: number) => void;
    changeCurrentLineClip: () => void;
    updateClipInfo: (srtKey: string, indexesInSrt: number[]) => Promise<void>;
};

export const mapClipKey = (srtKey: string, indexInSrt: number) => `${srtKey}::=::${indexInSrt}`;

const useFavouriteClip = create(
    subscribeWithSelector<UseFavouriteClipState & UseFavouriteClipActions>((set, get) => ({
        playInfo: null,
        currentTime: 0,
        lineClip: new Map(),
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
            const key = mapClipKey(srtHash, currentSentence.index);
            let exists = get().lineClip.get(key);
            if (exists === undefined) {
                exists = await api.call('favorite-clips/exists', { srtKey: srtHash, linesInSrt: [currentSentence.index] }).then((map) => map.get(currentSentence.index) ?? false);
            }
            set((state) => {
                const lineClip = new Map(state.lineClip);
                lineClip.set(key, !exists);
                return { lineClip };
            });
            if (exists) {
                await api.call('favorite-clips/cancel-add', { srtKey: srtHash, indexInSrt: currentSentence.index });
            } else {
                await api.call('favorite-clips/add', { videoPath, srtKey: srtHash, indexInSrt: currentSentence.index });
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
        }
    }))
);

export default useFavouriteClip;
