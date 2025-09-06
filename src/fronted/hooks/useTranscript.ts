import { create } from 'zustand';
import { persist, subscribeWithSelector } from 'zustand/middleware';
import toast from 'react-hot-toast';
import { SWR_KEY, swrMutate } from '@/fronted/lib/swr-util';

const api = window.electron;

export interface TranscriptTask {
    file: string;
    taskId: number | null;
}

export type UseTranscriptState = {
    files: TranscriptTask[];
};

export type UseTranscriptAction = {
    onAddToQueue(p: string): void;
    onDelFromQueue(p: string): void;
    onTranscript(p: string): Promise<number>;
    updateTranscriptTasks: (updates: Array<{ filePath: string; taskId: number | null; status?: string; progress?: number; result?: any }>) => void;
};


const useTranscript = create(
    persist(
        subscribeWithSelector<UseTranscriptState & UseTranscriptAction>((set, get) => ({
            files: [],
            onAddToQueue: async (p) => {
                const video = {
                    file: p,
                    taskId: null
                } as TranscriptTask;
                const currentFiles = get().files.map((f) => f.file);
                if (!currentFiles.includes(video.file)) {
                    set({ files: [...get().files, video] });
                }
            },
            onDelFromQueue(p: string) {
                const newFiles = get().files.filter((f) => f.file !== p);
                set({ files: newFiles });
            },
            onTranscript: async (file: string) => {
                const taskId = await api.call('ai-func/transcript', { filePath: file });
                // 如果没有就新增，有就更新
                const currentFiles = get().files.map((f) => f.file);
                if (!currentFiles.includes(file)) {
                    set({ files: [...get().files, { file, taskId }] });
                } else {
                    const newFiles = get().files.map((f) => {
                        if (f.file === file) {
                            return { ...f, taskId };
                        }
                        return f;
                    });
                    set({ files: newFiles });
                }
                return taskId;
            },
            updateTranscriptTasks: (updates) => {
                set((state) => {
                    const newFiles = [...state.files];
                    
                    updates.forEach(async (update) => {
                        const { filePath, taskId, status, progress, result } = update;
                        const existingIndex = newFiles.findIndex((f) => f.file === filePath);
                        
                        if (existingIndex >= 0) {
                            // 更新现有任务
                            if (taskId !== undefined) {
                                newFiles[existingIndex] = { ...newFiles[existingIndex], taskId };
                            }
                        } else if (taskId !== null) {
                            // 添加新任务
                            newFiles.push({ file: filePath, taskId });
                        }
                        
                        // 处理转录完成逻辑
                        if (status === 'completed' && result?.srtPath) {
                            await api.call('watch-history/attach-srt', {
                                videoPath: filePath,
                                srtPath: 'same'
                            });
                            await swrMutate(SWR_KEY.PLAYER_P);
                            toast('Transcript done', {
                                icon: '🚀'
                            });
                        }
                    });
                    
                    return { files: newFiles };
                });
            }
        })),
        {
            name: 'transcript-page-info'
        }
    )
);


export default useTranscript;
