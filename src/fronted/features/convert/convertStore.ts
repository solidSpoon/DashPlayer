/**
 * 管理转码页面的文件队列、文件夹队列以及后端任务状态。
 */
import { create } from 'zustand';
import { persist, subscribeWithSelector } from 'zustand/middleware';
import { FolderVideos } from '@/common/contracts/convert';
import useDpTaskCenter from '@/fronted/hooks/useDpTaskCenter';
import { DpTaskState } from '@/common/contracts/dp-task';
import { getRendererLogger } from '@/fronted/log/simple-logger';
import { convertApi } from './convertApi';

/** 转码功能持久化的队列与运行时任务状态。 */
export type UseConvertState = {
    /** 文件路径到后端任务编号的映射。 */
    tasks: Map<string, number>;
    /** 文件路径到任务状态的映射。 */
    taskStats: Map<string, DpTaskState>;
    /** 单独加入队列的视频绝对路径。 */
    files: string[];
    /** 按文件夹加入队列的视频集合。 */
    folders: FolderVideos[];
};

/** 转码功能对页面暴露的操作。 */
export type UseConvertAction = {
    addFiles: (files: string[]) => void;
    addFolders: (folders: FolderVideos[]) => void;
    deleteFile: (file: string) => void;
    deleteFolder: (folder: string, file?: string) => void;
    convert: (file: string) => void;
    convertFolder: (folder: string) => void;
};

const useConvert = create(
    persist(
        subscribeWithSelector<UseConvertState & UseConvertAction>((set, get) => ({
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
            convert: async (file) => {
                getRendererLogger('useConvert').debug('task stats', { taskStats: Object.fromEntries(get().taskStats) });
                if (get().taskStats.get(file) && get().taskStats.get(file) === DpTaskState.IN_PROGRESS) {
                    return;
                }
                const taskId = await useDpTaskCenter.getState()
                    .register(() => convertApi.startConversion(file), {
                        onUpdated: (t) => {
                            set({ taskStats: new Map([...get().taskStats, [file, t.status as DpTaskState]]) });
                        },
                        onFinish: (t) => {
                            set({ taskStats: new Map([...get().taskStats, [file, t.status as DpTaskState]]) });
                        }
                    })
                set({ tasks: new Map([...get().tasks, [file, taskId]]) });
            },
            convertFolder: async (folder) => {
                const folderEntry = get().folders.find(f => f.folder === folder);
                if (!folderEntry) {
                    throw new Error(`转换队列中不存在文件夹：${folder}`);
                }
                const videos = folderEntry.videos;
                for (const video of videos) {
                    getRendererLogger('useConvert').debug('task stats', { taskStats: Object.fromEntries(get().taskStats) });
                    if (get().taskStats.get(video) === DpTaskState.IN_PROGRESS) {
                        continue;
                    }
                    get().convert(video);
                }
            }
        }))
        , {
            name: 'convert-page-info'
        }
    )
);

useConvert.setState({
    taskStats: new Map(),
    tasks: new Map()
});

export default useConvert;
