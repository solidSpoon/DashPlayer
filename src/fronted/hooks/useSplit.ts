import {create} from 'zustand';
import {persist, subscribeWithSelector} from 'zustand/middleware';
import {ChapterParseResult} from "@/common/types/chapter-result";
import {isMedia, isSrt} from "@/common/utils/MediaTypeUtil";
import {strBlank} from "@/common/utils/Util";
import useDpTaskCenter from "@/fronted/hooks/useDpTaskCenter";
import toast from "react-hot-toast";

const api = window.electron;

export interface TaskChapterParseResult extends ChapterParseResult {
    taskId: number | null;
}

export type UseSplitState = {
    videoPath: string | null;
    srtPath: string | null;
    userInput: string;
    parseResult: TaskChapterParseResult[];
};

export type UseSplitAction = {
    updateFile(filePath: string): void;
    setUseInput(input: string): void;
    deleteFile(filePath: string): void;
    runSplitAll(): Promise<void>;
    runSplitOne(result: ChapterParseResult): Promise<void>;
};


const useSplit = create(
    persist(
        subscribeWithSelector<UseSplitState & UseSplitAction>((set, get) => ({
            videoPath: null,
            srtPath: null,
            userInput: '',
            parseResult: [],
            updateFile: async (filePath) => {
                if (strBlank(filePath)) {
                    return;
                }
                if (isMedia(filePath)) {
                    set({videoPath: filePath});
                }
                if (isSrt(filePath)) {
                    set({srtPath: filePath});
                }
                set({parseResult: get().parseResult.map(r => ({...r, taskId: null}))});
            },
            setUseInput: (input) => {
                set({userInput: input});
            },
            deleteFile: (filePath) => {
                if (get().videoPath === filePath) {
                    set({videoPath: null});
                }
                if (get().srtPath === filePath) {
                    set({srtPath: null});
                }
            },
            runSplitAll: async () => {
                if (!get().videoPath) {
                    toast('Please select a video file first');
                    return;
                }
                for (const result of get().parseResult) {
                    console.log(result);
                    await get().runSplitOne(result);
                }
            },
            runSplitOne: async (result) => {
                if (get().videoPath) {
                    const fileInfo = await api.call('system/path-info', get().videoPath);
                    const taskId = await useDpTaskCenter.getState().register(() => api.call('split-video/split-one', {
                        videoPath: get().videoPath,
                        srtPath: get().srtPath,
                        chapter: result
                    }), {
                        onFinish: async (task) => {
                            await api.call('watch-project/create/from-folder', get().videoPath.replace(fileInfo.extName, ''));
                        }
                    });
                    const newResult = get().parseResult
                        .map(r => (r.original === result.original ? {...r, taskId} : r));
                    set({parseResult: newResult});
                } else {
                    toast('Please select a video file first');
                }
            }
        }))
        , {
            name: 'split-page-info'
        }
    )
);

useSplit.subscribe(
    (s) => s.userInput,
    async (topic) => {
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
