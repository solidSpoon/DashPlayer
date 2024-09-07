import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { SrtLine } from '@/common/utils/SrtUtil';
import { registerDpTask } from '@/fronted/hooks/useDpTaskCenter';
import { OssObject } from '@/common/types/OssObject';
export interface PlayInfo {
    video: OssObject;
    /**
     * 从 0 开始的时间
     */
    time: number;
    timeUpdated: number;
}

const api = window.electron;
type UseFavouriteClipState = {
    unfinishedTasks: {
        taskId: number;
        videoPath: string;
    }[];
    playInfo: PlayInfo | null;
    currentTime: number;

};
type UseFavouriteClipActions = {
    addClip: (videoPath: string, srtClip: SrtLine, srtContext: SrtLine[]) => void;
    finishTask: (taskId: number) => void;
    setPlayInfo: (playInfo: PlayInfo | null) => void;
    setCurrentTime: (currentTime: number) => void;
};

const useFavouriteClip = create(
    subscribeWithSelector<UseFavouriteClipState & UseFavouriteClipActions>((set) => ({
        unfinishedTasks: [],
        playInfo: null,
        currentTime: 0,
        addClip: async (videoPath: string, srtClip: SrtLine, srtContext: SrtLine[]) => {
            const tid = await registerDpTask(async () => await api.call('favorite-clips/add', {
                videoPath,
                srtClip,
                srtContext
            }), {
                onFinish: (task) => {
                    useFavouriteClip.getState().finishTask(task.id);
                }
            });
            set((s) => {
                return {
                    unfinishedTasks: [...s.unfinishedTasks, { taskId: tid, videoPath }]
                };
            });
        },
        finishTask: (taskId: number) => {
            set((s) => {
                return {
                    unfinishedTasks: s.unfinishedTasks.filter((t) => t.taskId !== taskId)
                };
            });
        },
        setPlayInfo: (playInfo: PlayInfo | null) => {
            set({ playInfo });
        },
        setCurrentTime: (currentTime: number) => {
            set({ currentTime });
        }
    }))
);

export default useFavouriteClip;
