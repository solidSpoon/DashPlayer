/**
 * 管理修复页面的文件队列、文件夹队列以及后端修复任务状态。
 */
import { create } from 'zustand';
import { persist, subscribeWithSelector } from 'zustand/middleware';
import { FolderVideos, RunningRepair } from '@/common/contracts/playback-repair';
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
    /** 把某个文件的修复任务接入本页状态，让列表显示它的进度。 */
    trackTask: (file: string, taskId: number) => Promise<void>;
    /** 接管后端正在运行的修复：播放页发起的修复也会出现在本页名单里。 */
    adoptRunningRepairs: (running: RunningRepair[]) => Promise<void>;
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
                await get().trackTask(file, taskId);
            },
            /**
             * 接入一条修复任务的进度。
             *
             * 先乐观标记为进行中，避免接管时短暂显示成「待修复」；真实状态由任务中心回报修正。
             *
             * @param file 被修复的媒体绝对路径。
             * @param taskId 后端任务编号。
             */
            trackTask: async (file, taskId) => {
                set({
                    taskStats: new Map([...get().taskStats, [file, DpTaskState.IN_PROGRESS]]),
                    tasks: new Map([...get().tasks, [file, taskId]])
                });
                await useDpTaskCenter.getState()
                    .register(async () => taskId, {
                        onUpdated: (t) => {
                            set({ taskStats: new Map([...get().taskStats, [file, t.status as DpTaskState]]) });
                        },
                        onFinish: (t) => {
                            set({ taskStats: new Map([...get().taskStats, [file, t.status as DpTaskState]]) });
                        }
                    });
            },
            /**
             * 接管后端正在运行的修复任务。
             *
             * 修复可以从播放页发起，那条任务不在本页队列里；打开页面时把不在名单中的运行任务
             * 补进来，两个入口看到的就是同一批进度，且不会重复启动修复。
             *
             * @param running 后端正在运行的修复任务。
             */
            adoptRunningRepairs: async (running) => {
                const known = new Set([
                    ...get().files,
                    ...get().folders.flatMap((folder) => folder.videos)
                ]);
                const adopted = running.filter((item) => !known.has(item.filePath));
                if (adopted.length === 0) {
                    return;
                }
                set({ files: [...get().files, ...adopted.map((item) => item.filePath)] });
                for (const item of adopted) {
                    await get().trackTask(item.filePath, item.taskId);
                }
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
