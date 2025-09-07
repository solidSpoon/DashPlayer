import { create } from 'zustand';
import { persist, subscribeWithSelector } from 'zustand/middleware';
import toast from 'react-hot-toast';
import { SWR_KEY, swrMutate } from '@/fronted/lib/swr-util';
import { DpTaskState } from '@/backend/db/tables/dpTask';

const api = window.electron;

export interface TranscriptTask {
    file: string;
    status?: DpTaskState | string;
    result?: any;
    created_at?: string;
    updated_at?: string;
}

export type UseTranscriptState = {
    files: TranscriptTask[];
};

export type UseTranscriptAction = {
    onAddToQueue(p: string): void;
    onDelFromQueue(p: string): void;
    onTranscript(p: string): Promise<void>;
    updateTranscriptTasks: (updates: Array<{ filePath: string; status?: string; result?: any }>) => void;
};


const useTranscript = create(
    persist(
        subscribeWithSelector<UseTranscriptState & UseTranscriptAction>((set, get) => ({
            files: [],
            onAddToQueue: async (p) => {
                const video = {
                    file: p
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
                const currentFiles = get().files.map((f) => f.file);
                const existingFile = get().files.find((f) => f.file === file);
                const isProcessing = existingFile && 
                    (existingFile.status === 'init' || existingFile.status === 'in_progress');
                
                if (isProcessing) {
                    // 如果文件正在处理中，不重复添加
                    return;
                }
                
                await api.call('ai-func/transcript', { filePath: file });
                // 如果没有就新增，有就更新状态
                if (!currentFiles.includes(file)) {
                    set({ files: [...get().files, { file, status: 'init' }] });
                } else {
                    const newFiles = get().files.map((f) => {
                        if (f.file === file) {
                            return { ...f, status: 'init' };
                        }
                        return f;
                    });
                    set({ files: newFiles });
                }
            },
            updateTranscriptTasks: (updates) => {
                set((state) => {
                    const newFiles = [...state.files];
                    
                    updates.forEach((update) => {
                        const { filePath, status, result } = update;
                        const existingIndex = newFiles.findIndex((f) => f.file === filePath);
                        
                        if (existingIndex >= 0) {
                            // 更新现有任务
                            const existingTask = newFiles[existingIndex];
                            newFiles[existingIndex] = {
                                ...existingTask,
                                status: status ?? existingTask.status,
                                result: result ?? existingTask.result,
                                updated_at: new Date().toISOString()
                            };
                        } else if (filePath && filePath !== 'unknown') {
                            // 添加新任务
                            newFiles.push({ 
                                file: filePath, 
                                status, 
                                result,
                                created_at: new Date().toISOString(),
                                updated_at: new Date().toISOString()
                            });
                        }
                        
                        // 处理转录完成逻辑
                        if (status === 'done' && result?.srtPath) {
                            // 使用 setTimeout 避免在 set 回调中执行异步操作
                            setTimeout(async () => {
                                try {
                                    await api.call('watch-history/attach-srt', {
                                        videoPath: filePath,
                                        srtPath: 'same'
                                    });
                                    await swrMutate(SWR_KEY.PLAYER_P);
                                    toast('Transcript done', {
                                        icon: '🚀'
                                    });
                                } catch (error) {
                                    console.error('Failed to attach SRT:', error);
                                }
                            }, 0);
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
