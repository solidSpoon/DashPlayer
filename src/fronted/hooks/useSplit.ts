import {create} from 'zustand';
import {subscribeWithSelector} from 'zustand/middleware';
import {ChapterParseResult} from "@/common/types/chapter-result";
import {isMidea, isSrt} from "@/common/utils/MediaTypeUitl";

const api = window.electron;

export type UseSplitState = {
    videoPath: string | null;
    srtPath: string | null;
    userInput: string;
    parseResult: ChapterParseResult[];

};

export type UseSplitAction = {
    updateFile(filePath: string): void;
    setUseInput(input: string): void;
};


const useSplit = create(
    subscribeWithSelector<UseSplitState & UseSplitAction>((set, get) => ({
        videoPath: null,
        srtPath: null,
        userInput: '',
        parseResult: [],
        updateFile: async (filePath) => {
            if (isMidea(filePath)) {
                set({videoPath: filePath});
            }
            if (isSrt(filePath)) {
                set({srtPath: filePath});
            }
        },
        setUseInput: (input) => {
            set({userInput: input});
        }
    }))
);

useSplit.subscribe(
    (s) => s.userInput,
    async (topic) => {
        const result = await api.call('split-video/preview', topic);
        useSplit.setState({parseResult: result});
    }
);


export default useSplit;
