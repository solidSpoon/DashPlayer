/**
 * 管理转录页面的文件队列、转录任务状态以及完成后的回流处理。
 */
import { create } from 'zustand';
import { persist, subscribeWithSelector } from 'zustand/middleware';
import toast from 'react-hot-toast';
import { SWR_KEY, swrMutate } from '@/fronted/lib/swr-util';
import { backendClient } from '@/fronted/application/bootstrap/backendClient';
import { getRendererLogger } from '@/fronted/log/simple-logger';
import {
    TranscriptTask,
    TranscriptTaskState,
    TranscriptTaskUpdate,
} from '@/common/contracts/transcript/transcript-task';

const api = backendClient;
const logger = getRendererLogger('useTranscript');

/** 持久化状态中处于非终态（重启后不可能再收到后端更新）的任务的中断提示。 */
const INTERRUPTED_MESSAGE = '转录任务已中断（应用重启），请重新转录';

/**
 * 归一化持久化到 localStorage 的任务列表：
 * 后端任务状态保存在内存中，重启后即丢失，因此 rehydrate 时把非终态任务重置为 failed，
 * 避免界面永久停留在“处理中”而永远收不到更新。
 */
function normalizePersistedFiles(persistedFiles: TranscriptTask[] | undefined): TranscriptTask[] {
    if (!Array.isArray(persistedFiles)) {
        return [];
    }
    return persistedFiles.map((task) => {
        if (task.status !== TranscriptTaskState.INIT && task.status !== TranscriptTaskState.IN_PROGRESS) {
            return task;
        }
        return {
            ...task,
            status: TranscriptTaskState.FAILED,
            result: {
                ...task.result,
                message: INTERRUPTED_MESSAGE,
            },
            updated_at: new Date().toISOString(),
        };
    });
}

export type UseTranscriptState = {
    files: TranscriptTask[];
};

export type UseTranscriptAction = {
    onAddToQueue(p: string): void;
    onDelFromQueue(p: string): void;
    onTranscript(p: string): Promise<'started' | 'model_missing'>;
    updateTranscriptTasks: (updates: TranscriptTaskUpdate[]) => void;
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
                const modelStatus = await api.call('parakeet/models/status');
                if (!modelStatus.ready) {
                    return 'model_missing';
                }

                const currentFiles = get().files.map((f) => f.file);
                const existingFile = get().files.find((f) => f.file === file);
                const isProcessing = existingFile &&
                    (existingFile.status === TranscriptTaskState.INIT || existingFile.status === TranscriptTaskState.IN_PROGRESS);

                if (isProcessing) {
                    // 如果文件正在处理中，不重复添加
                    return 'started';
                }

                await api.call('ai-func/transcript', { filePath: file });
                // 如果没有就新增，有就更新状态
                if (!currentFiles.includes(file)) {
                    set({ files: [...get().files, { file, status: TranscriptTaskState.INIT }] });
                } else {
                    const newFiles = get().files.map((f) => {
                        if (f.file === file) {
                            return { ...f, status: TranscriptTaskState.INIT };
                        }
                        return f;
                    });
                    set({ files: newFiles });
                }
                return 'started';
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
                                    logger.error('Failed to attach SRT', { error });
                                }
                            }, 0);
                        }
                    });

                    return { files: newFiles };
                });
            }
        })),
        {
            name: 'transcript-page-info',
            merge: (persistedState, currentState) => {
                const persisted = persistedState as Partial<UseTranscriptState & UseTranscriptAction> | undefined;
                return {
                    ...currentState,
                    ...(persisted ?? {}),
                    files: normalizePersistedFiles(persisted?.files),
                };
            },
        }
    )
);


export default useTranscript;
