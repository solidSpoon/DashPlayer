import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { OssObject } from '@/common/types/OssObject';
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

};
type UseFavouriteClipActions = {
    setPlayInfo: (playInfo: PlayInfo | null) => void;
    setCurrentTime: (currentTime: number) => void;
};

const useFavouriteClip = create(
    subscribeWithSelector<UseFavouriteClipState & UseFavouriteClipActions>((set) => ({
        playInfo: null,
        currentTime: 0,
        setPlayInfo: (playInfo: PlayInfo | null) => {
            set({ playInfo });
        },
        setCurrentTime: (currentTime: number) => {
            set({ currentTime });
        }
    }))
);

export default useFavouriteClip;
