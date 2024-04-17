import {create} from 'zustand';
import {subscribeWithSelector} from 'zustand/middleware';
import {ChapterParseResult} from "@/common/types/chapter-result";
import {isMidea, isSrt} from "@/common/utils/MediaTypeUitl";
import {strBlank} from "@/common/utils/Util";

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
    subscribeWithSelector<UseSplitState & UseSplitAction>((set, get) => ({
        videoPath: null,
        srtPath: null,
        userInput: '',
        parseResult: [],
        updateFile: async (filePath) => {
            if (strBlank(filePath)) {
                return;
            }
            if (isMidea(filePath)) {
                set({videoPath: filePath});
            }
            if (isSrt(filePath)) {
                set({srtPath: filePath});
            }
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
            // if (get().videoPath) {
            //     api.call('split-video/split-one', {
            //         filePath: get().videoPath,
            //         param: get().parseResult[0]
            //     });
            // }
        },
        runSplitOne: async (result) => {
            if (get().videoPath) {
                api.call('split-video/split-one', {
                    filePath: get().videoPath,
                    param: result
                });
            }
            if (get().srtPath) {
                // api.call('split-video/split-srt-one', {
                //     filePath: get().srtPath,
                //     param: result
                // });
            }
        }
    }))
);

useSplit.subscribe(
    (s) => s.userInput,
    async (topic) => {
        const result = await api.call('split-video/preview', topic);
        const oldState: Map<string, TaskChapterParseResult> = new Map(useSplit.getState().parseResult.map(r => [r.original, r]));
        useSplit.setState({parseResult: result.map(r => ({
                ...r,
                taskId: oldState.get(r.original)?.taskId ?? null
        }))});
    }
);


export default useSplit;
