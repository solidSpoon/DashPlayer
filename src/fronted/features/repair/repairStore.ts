/**
 * 管理修复页面的文件队列、文件夹队列以及后端修复任务状态。
 */
import { create } from 'zustand';
import { persist, subscribeWithSelector } from 'zustand/middleware';
import { FolderVideos } from '@/common/contracts/playback-repair';
import useDpTaskCenter from '@/fronted/hooks/useDpTaskCenter';
import { DpTaskState } from '@/common/contracts/dp-task';
import { getRendererLogger } from '@/fronted/log/simple-logger';
import { repairApi } from './repairApi';

/** 修复功能持久化的队列与运行时任务状态。 */
export type UseRepairState = {
    /** 文件路径到后端任务编号的映射。 */
    tasks: Map<string, number>;
    /** 文件路径到任务状态的映射。 */
    taskStats: Map<string, DpTaskState>;
    /** 单独加入队列的媒体绝对路径。 */
    files: string[];
    /** 按文件夹加入队列的媒体集合。 */
    folders: FolderVideos[];
};

/** 修复功能对页面暴露的操作。 */
export type UseRepairAction = {
    addFiles: (files: string[]) => void;
    addFolders: (folders: FolderVideos[]) => void;
    deleteFile: (file: string) => void;
    deleteFolder: (folder: string, file?: string) => void;
    repair: (file: string) => void;
    repairFolder: (folder: string) => void;
};

const useRepair = create(
    persist(
        subscribeWithSelector<UseRepairState & UseRepairAction>((set, get) => ({
            tasks: new Map(),
            taskStats: new Map(),
            files: [],
            folders: [],
            addFiles: (files) => {
                const tf = get().files.filter(f => !files.includes(f));
                set({ files: [...tf, ...files] });
            },
            addFolders: (folders) => {
                const tf = get().folders.filter(f => !folders.map(f => f.folder).includes(f.folder));
                set({ folders: [...tf, ...folders] });
            },
            deleteFile: (file) => {
                set({ files: get().files.filter(f => f !== file) });
            },
            deleteFolder: (folder, file) => {
                if (file) {
                    set({
                        folders: get().folders.map(f => {
                            if (f.folder === folder) {
                                return {
                                    ...f,
                                    videos: f.videos.filter(v => v !== file)
                                };
                            }
                            return f;
                        })
                    });
                } else {
                    set({ folders: get().folders.filter(f => f.folder !== folder) });
                }
            },
            /**
             * 启动单个媒体的修复任务。
             *
             * 诊断结论为「无需修复」时后端不会创建任务，这里直接标记为已完成，
             * 让界面上的该项退回可操作状态，而不是一直停在待修复。
             */
            repair: async (file) => {
                getRendererLogger('useRepair').debug('task stats', { taskStats: Object.fromEntries(get().taskStats) });
                if (get().taskStats.get(file) === DpTaskState.IN_PROGRESS) {
                    return;
                }
                const { taskId } = await repairApi.startRepair(file);
                if (taskId === null) {
                    set({ taskStats: new Map([...get().taskStats, [file, DpTaskState.DONE]]) });
                    return;
                }
                await useDpTaskCenter.getState()
                    .register(async () => taskId, {
                        onUpdated: (t) => {
                            set({ taskStats: new Map([...get().taskStats, [file, t.status as DpTaskState]]) });
                        },
                        onFinish: (t) => {
                            set({ taskStats: new Map([...get().taskStats, [file, t.status as DpTaskState]]) });
                        }
                    });
                set({ tasks: new Map([...get().tasks, [file, taskId]]) });
            },
            repairFolder: async (folder) => {
                const folderEntry = get().folders.find(f => f.folder === folder);
                if (!folderEntry) {
                    throw new Error(`修复队列中不存在文件夹：${folder}`);
                }
                for (const video of folderEntry.videos) {
                    getRendererLogger('useRepair').debug('task stats', { taskStats: Object.fromEntries(get().taskStats) });
                    if (get().taskStats.get(video) === DpTaskState.IN_PROGRESS) {
                        continue;
                    }
                    get().repair(video);
                }
            }
        }))
        , {
            name: 'repair-page-info'
        }
    )
);

useRepair.setState({
    taskStats: new Map(),
    tasks: new Map()
});

export default useRepair;
