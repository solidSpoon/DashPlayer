import { create } from 'zustand';
import { persist, subscribeWithSelector } from 'zustand/middleware';
import { ChapterParseResult } from '@/common/types/chapter-result';
import MediaUtil from '@/common/utils/MediaUtil';
import useDpTaskCenter from '@/fronted/hooks/useDpTaskCenter';
import { SWR_KEY, swrApiMutate, swrMutate } from '@/fronted/lib/swr-util';
import StrUtil from '@/common/utils/str-util';

const api = window.electron;

export interface TaskChapterParseResult extends ChapterParseResult {
    taskId: number | null;
}

export type UseSplitState = {
    videoPath: string | null;
    srtPath: string | null;
    userInput: string;
    parseResult: TaskChapterParseResult[];
    inputable: boolean;
};

export type UseSplitAction = {
    updateFile(filePath: string): void;
    setUseInput(input: string): void;
    deleteFile(filePath: string): void;
    runSplitAll(): Promise<void>;
    aiFormat: () => void;
};


const useSplit = create(
    persist(
        subscribeWithSelector<UseSplitState & UseSplitAction>((set, get) => ({
            videoPath: null,
            srtPath: null,
            userInput: '',
            parseResult: [],
            inputable: true,
            updateFile: async (filePath) => {
                if (StrUtil.isBlank(filePath)) {
                    return;
                }
                if (MediaUtil.isMedia(filePath)) {
                    set({ videoPath: filePath });
                }
                if (MediaUtil.isSrt(filePath)) {
                    set({ srtPath: filePath });
                }
                set({ parseResult: get().parseResult.map(r => ({ ...r, taskId: null })) });
            },
            setUseInput: (input) => {
                set({ userInput: input });
            },
            deleteFile: (filePath) => {
                if (get().videoPath === filePath) {
                    set({ videoPath: null });
                }
                if (get().srtPath === filePath) {
                    set({ srtPath: null });
                }
            },
            runSplitAll: async () => {
                if (!useSplit.getState().videoPath) {
                    throw new Error('Please select a video file first');
                }
                for (const chapter of get().parseResult) {
                    if (!chapter.timestampValid || StrUtil.isBlank(chapter.title)) {
                        throw new Error('请修正红色部分');
                    }
                }
                const folderName = await api.call('split-video/split', {
                    videoPath: useSplit.getState().videoPath ?? '',
                    srtPath: useSplit.getState().srtPath,
                    chapters: useSplit.getState().parseResult
                });
                await api.call('watch-history/create', [folderName]);
                await swrApiMutate('watch-history/list');
            },
            aiFormat: async () => {
                if (StrUtil.isBlank(get().userInput)) {
                    return;
                }
                const userInput = get().userInput;
                set({ inputable: false });
                await useDpTaskCenter.getState().register(() => api.call('ai-func/format-split', userInput), {
                    onUpdated: (task) => {
                        if (StrUtil.isBlank(task?.result)) return;
                        // const res = JSON.parse(task.result) as AiFuncFormatSplitRes;
                        useSplit.setState({
                            userInput: task.result
                        });
                    },
                    onFinish: () => {
                        useSplit.setState({ inputable: true });
                    },
                });
            }
        }))
        , {
            name: 'split-page-info'
        }
    )
);

useSplit.setState({
    inputable: true
});

useSplit.subscribe(
    (s) => s.userInput,
    async (topic) => {
        if (StrUtil.isBlank(topic)) {
            useSplit.setState({ parseResult: [] });
            return;
        }
        const result = await api.call('split-video/preview', topic);
        const oldState: Map<string, TaskChapterParseResult> = new Map(useSplit.getState().parseResult.map(r => [r.original, r]));
        useSplit.setState({
            parseResult: result.map(r => ({
                ...r,
                taskId: oldState.get(r.original)?.taskId ?? null
            }))
        });
    }
);


export default useSplit;
