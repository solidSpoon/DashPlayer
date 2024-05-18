import { create } from 'zustand';
import { persist, subscribeWithSelector } from 'zustand/middleware';
import { FolderVideos } from '@/common/types/tonvert-type';
import useDpTaskCenter from '@/fronted/hooks/useDpTaskCenter';
import { DpTaskState } from '@/backend/db/tables/dpTask';

const api = window.electron;


export type UseConvertState = {
    tasks: Map<string, number>;
    taskStats: Map<string, DpTaskState>;
    files: string[];
    folders: FolderVideos[];
};

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
                set({ files: [...get().files, ...files] });
            },
            addFolders: (folders) => {
                set({ folders: [...get().folders, ...folders] });
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
                if (get().taskStats.get(file) === DpTaskState.IN_PROGRESS) {
                    return;
                }
                const taskId = await useDpTaskCenter.getState()
                    .register(()=> api.call('convert/to-mp4', file),{
                        onUpdated: (t) => {
                            set({ taskStats: new Map([...get().taskStats, [file, t.status as DpTaskState]]) });
                        }
                    })
                set({ tasks: new Map([...get().tasks, [file, taskId]]) });
            },
            convertFolder: async (folder) => {
                //videos for
                const videos = get().folders.find(f => f.folder === folder)?.videos ?? [];
                for (const video of videos) {
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
export default useConvert;
