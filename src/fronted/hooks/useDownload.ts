import { create } from 'zustand';
import { persist, subscribeWithSelector } from 'zustand/middleware';
import { backendClient } from '@/fronted/application/bootstrap/backendClient';
import useDpTaskCenter from '@/fronted/hooks/useDpTaskCenter';
import { DownloadMetadata } from '@/backend/application/ports/gateways/media/DownloadGateway';

const api = backendClient;

export interface DownloadTaskInfo {
    id: number;
    url: string;
    title: string;
    thumbnail?: string;
    status: 'pending' | 'downloading' | 'finishing' | 'done' | 'failed';
    percent: number;
    speed?: string;
    eta?: string;
    savePath?: string;
}

export type UseDownloadState = {
    tasks: Map<number, DownloadTaskInfo>;
    history: DownloadMetadata[];
};

export type UseDownloadAction = {
    getMetadata: (url: string) => Promise<DownloadMetadata>;
    startDownload: (url: string, savePath?: string, metadata?: DownloadMetadata) => Promise<number>;
    clearTasks: () => void;
};

const useDownload = create(
    persist(
        subscribeWithSelector<UseDownloadState & UseDownloadAction>((set, get) => ({
            tasks: new Map(),
            history: [],
            getMetadata: async (url) => {
                const metadata = await api.call('download/get-metadata', url);
                set(state => {
                    const exists = state.history.find(h => h.url === url);
                    if (exists) return state;
                    return { history: [metadata, ...state.history].slice(0, 50) };
                });
                return metadata;
            },
            startDownload: async (url, savePath, metadata) => {
                const taskId = await useDpTaskCenter.getState().register(
                    () => api.call('download/start', { url, savePath }),
                    {
                        onUpdated: (task) => {
                            try {
                                const result = JSON.parse(task.result || '{}');
                                set(state => {
                                    const tasks = new Map(state.tasks);
                                    const existing = tasks.get(taskId);
                                    tasks.set(taskId, {
                                        id: taskId,
                                        url,
                                        title: metadata?.title || existing?.title || 'Unknown',
                                        thumbnail: metadata?.thumbnail || existing?.thumbnail,
                                        status: 'downloading',
                                        percent: result.percent || 0,
                                        speed: result.speed,
                                        eta: result.eta,
                                        savePath: result.path
                                    });
                                    return { tasks };
                                });
                            } catch (e) {
                                // Ignore parse error
                            }
                        },
                        onFinish: (task) => {
                            set(state => {
                                const tasks = new Map(state.tasks);
                                const existing = tasks.get(taskId);
                                tasks.set(taskId, {
                                    id: taskId,
                                    url,
                                    title: metadata?.title || existing?.title || 'Unknown',
                                    thumbnail: metadata?.thumbnail || existing?.thumbnail,
                                    status: task.status === 'DONE' ? 'done' : 'failed',
                                    percent: 100,
                                    savePath: existing?.savePath
                                });
                                return { tasks };
                            });
                        }
                    }
                );

                set(state => {
                    const tasks = new Map(state.tasks);
                    tasks.set(taskId, {
                        id: taskId,
                        url,
                        title: metadata?.title || 'Unknown',
                        thumbnail: metadata?.thumbnail,
                        status: 'pending',
                        percent: 0,
                    });
                    return { tasks };
                });

                return taskId;
            },
            clearTasks: () => {
                set({ tasks: new Map() });
            }
        })),
        {
            name: 'video-download-storage',
            storage: {
                getItem: (name) => {
                    const str = localStorage.getItem(name);
                    if (!str) return null;
                    const data = JSON.parse(str);
                    if (data.state && data.state.tasks) {
                        data.state.tasks = new Map(
                            Object.entries(data.state.tasks).map(([k, v]) => [Number(k), v])
                        );
                    }
                    return data as any;
                },
                setItem: (name, value) => {
                    const data = { ...value } as any;
                    if (data.state && data.state.tasks) {
                        data.state.tasks = Object.fromEntries(data.state.tasks);
                    }
                    localStorage.setItem(name, JSON.stringify(data));
                },
                removeItem: (name) => localStorage.removeItem(name),
            }
        }
    )
);

export default useDownload;
