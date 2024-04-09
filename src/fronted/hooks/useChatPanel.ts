import {create} from 'zustand';
import {subscribeWithSelector} from 'zustand/middleware';
import {AiAnalyseNewWordsRes} from "@/common/types/AiAnalyseNewWordsRes";
import {AiAnalyseNewPhrasesRes} from "@/common/types/AiAnalyseNewPhrasesRes";
import {AiMakeExampleSentencesRes} from "@/common/types/AiMakeExampleSentencesRes";
import {BaseMessage} from "@langchain/core/messages";
import UndoRedo from "@/common/utils/UndoRedo";
import {DpTask, DpTaskState} from "@/backend/db/tables/dpTask";
import {sleep} from "@/common/utils/Util";
import usePlayerController from "@/fronted/hooks/usePlayerController";

const api = window.electron;

export type Topic = {
    start: {
        sIndex: number;
        cIndex: number;
    },
    end: {
        sIndex: number;
        cIndex: number;
    }
} | 'offscreen';

export type Tasks = {
    vocabularyTask: number | 'init' | 'done';
    phraseTask: number | 'init' | 'done';
    sentenceTask: number | 'init' | 'done';
    chatTask: number | 'done';
}

const undoRedo = new UndoRedo<ChatPanelState>();

export type ChatPanelState = {
    tasks: Tasks;
    topic: Topic
    newVocabulary: AiAnalyseNewWordsRes;
    newPhrase: AiAnalyseNewPhrasesRes;
    newSentence: AiMakeExampleSentencesRes;
    messages: BaseMessage[];
    canUndo: boolean;
    canRedo: boolean;
};

export type ChatPanelActions = {
    backward: () => void;
    forward: () => void;
    createTopic: (topic: Topic) => void;
    clear: () => void;
    setTask: (tasks: Tasks) => void;
};

const copy = (state: ChatPanelState): ChatPanelState => {
    return {
        tasks: {
            vocabularyTask: state.tasks.vocabularyTask,
            phraseTask: state.tasks.phraseTask,
            sentenceTask: state.tasks.sentenceTask,
            chatTask: state.tasks.chatTask
        },
        topic: state.topic,
        newVocabulary: state.newVocabulary,
        newPhrase: state.newPhrase,
        newSentence: state.newSentence,
        messages: state.messages,
        canUndo: state.canUndo,
        canRedo: state.canRedo
    }
}

const empty = (): ChatPanelState => {
    return {
        tasks: {
            vocabularyTask: 'init',
            phraseTask: 'init',
            sentenceTask: 'init',
            chatTask: 'done'
        },
        topic: null,
        newVocabulary: null,
        newPhrase: null,
        newSentence: null,
        messages: [],
        canUndo: false,
        canRedo: false
    }
}

const useChatPanel = create(
    subscribeWithSelector<ChatPanelState & ChatPanelActions>((set, get) => ({
        ...empty(),
        backward: () => {
            if (!undoRedo.canUndo()) return;
            set({
                ...undoRedo.undo(),
                canUndo: undoRedo.canUndo(),
                canRedo: undoRedo.canRedo()
            })
        },
        forward: () => {
            if (!undoRedo.canRedo()) return;
            set({
                ...undoRedo.redo(),
                canUndo: undoRedo.canUndo(),
                canRedo: undoRedo.canRedo()
            });

        },
        createTopic: (topic: Topic) => {
            undoRedo.add(copy(get()));
            set(empty());
        },
        clear: () => {
            undoRedo.clear();
            set(empty());
        },
        setTask: (tasks: Tasks) => {
            set({
                tasks: {
                    ...tasks
                }
            });
        }
    }))
);

const extractTopic = (t: Topic): string => {
    if (t === 'offscreen') return 'offscreen';
    const subtitle = usePlayerController.getState().subtitle;
    const length = subtitle?.length ?? 0;
    if (length === 0 || t.start.sIndex > length || t.end.sIndex > length) {
        return 'extractTopic failed';
    }
    let st = subtitle[t.start.sIndex].text;
    // from t.start.cIndex to end of st
    if (t.start.cIndex > 0 && t.start.cIndex < st.length) {
        st = st.slice(t.start.cIndex);
    }
    let et = subtitle[t.end.sIndex].text;
    if (t.end.cIndex > 0 && t.end.cIndex < et.length) {
        et = et.slice(0, t.end.cIndex);
    }
    return `${st} ${et}`;
}


const runVocabulary = async () => {
    let tId = useChatPanel.getState().tasks.vocabularyTask;
    if (tId === 'done') return;
    if (tId === 'init') {
        tId = await api.aiAnalyzeNewWords(extractTopic(useChatPanel.getState().topic));
        useChatPanel.getState().setTask({
            ...useChatPanel.getState().tasks,
            vocabularyTask: tId
        });
    }
    const tRes: DpTask = await api.dpTaskDetail(tId);
    if (tRes.status === DpTaskState.IN_PROGRESS || tRes.status === DpTaskState.DONE) {
        const res = JSON.parse(tRes.result) as AiAnalyseNewWordsRes;
        useChatPanel.setState({
            newVocabulary: res
        });
    }
    if (tRes.status === DpTaskState.DONE) {
        useChatPanel.getState().setTask({
            ...useChatPanel.getState().tasks,
            vocabularyTask: 'done'
        });
    }
}

const runPhrase = async () => {
    let tId = useChatPanel.getState().tasks.phraseTask;
    if (tId === 'done') return;
    if (tId === 'init') {
        tId = await api.aiAnalyzeNewPhrases(extractTopic(useChatPanel.getState().topic));
        useChatPanel.getState().setTask({
            ...useChatPanel.getState().tasks,
            phraseTask: tId
        });
    }
    const tRes: DpTask = await api.dpTaskDetail(tId);
    if (tRes.status === DpTaskState.IN_PROGRESS || tRes.status === DpTaskState.DONE) {
        const res = JSON.parse(tRes.result) as AiAnalyseNewPhrasesRes;
        useChatPanel.setState({
            newPhrase: res
        });
    }
    if (tRes.status === DpTaskState.DONE) {
        useChatPanel.getState().setTask({
            ...useChatPanel.getState().tasks,
            phraseTask: 'done'
        });
    }
}

const runSentence = async () => {
    const state = useChatPanel.getState();
    let tId = state.tasks.sentenceTask;
    if (tId === 'done') return;
    if (state.tasks.phraseTask !== 'done' || state.tasks.phraseTask !== 'done') {
        return;
    }
    const points = [
        ...state.newVocabulary.words.map(w => w.word),
        ...state.newPhrase.phrases.map(p => p.phrase)
    ]
    if (tId === 'init') {
        tId = await api.aiMakeExampleSentences(extractTopic(useChatPanel.getState().topic), points);
        useChatPanel.getState().setTask({
            ...useChatPanel.getState().tasks,
            sentenceTask: tId
        });
    }
    const tRes: DpTask = await api.dpTaskDetail(tId);
    if (tRes.status === DpTaskState.IN_PROGRESS || tRes.status === DpTaskState.DONE) {
        const res = JSON.parse(tRes.result) as AiMakeExampleSentencesRes;
        useChatPanel.setState({
            newSentence: res
        });
    }
    if (tRes.status === DpTaskState.DONE) {
        useChatPanel.getState().setTask({
            ...useChatPanel.getState().tasks,
            sentenceTask: 'done'
        });
    }
}

const runChat = async () => {
    const tId = useChatPanel.getState().tasks.chatTask;
    if (tId === 'done') return;
    const tRes: DpTask = await api.dpTaskDetail(tId);
    if (tRes.status === DpTaskState.IN_PROGRESS || tRes.status === DpTaskState.DONE) {
        // const res = JSON.parse(tRes.result) as BaseMessage[];
        // useChatPanel.setState({
        //     messages: res
        // });
    }
}

useChatPanel.subscribe(
    (s) => s.topic,
    async (topic) => {
        if (topic === 'offscreen') {
            return;
        }
        while (useChatPanel.getState().topic !== 'offscreen') {
            await runVocabulary();
            await runPhrase();
            await runSentence();
            await runChat();
            await sleep(100);
        }
    }
);


export default useChatPanel;
