import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { SrtLine } from '@/common/utils/SrtUtil';
import { registerDpTask } from '@/fronted/hooks/useDpTaskCenter';
const api = window.electron;
type UseFavouriteClipState = {
    unfinishedTasks: {
        taskId: number;
        videoPath: string;
    }[];
};

type UseFavouriteClipActions = {
    addClip: (videoPath: string, srtClip: SrtLine[]) => void;
    finishTask: (taskId: number) => void;
};

const useFavouriteClip = create(
    subscribeWithSelector<UseFavouriteClipState & UseFavouriteClipActions>((set) => ({
        unfinishedTasks: [],
        addClip: async (videoPath: string, srtClip: SrtLine[]) => {
            const tid = await registerDpTask(async () => await api.call('favorite-clips/add', { videoPath, srtClip }),{
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
        }
    }))
);

export default useFavouriteClip;
