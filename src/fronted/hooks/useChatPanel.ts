import {create} from 'zustand';
import {subscribeWithSelector} from 'zustand/middleware';
import {AiAnalyseNewWordsRes} from "@/common/types/aiRes/AiAnalyseNewWordsRes";
import {AiAnalyseNewPhrasesRes} from "@/common/types/aiRes/AiAnalyseNewPhrasesRes";
import {AiMakeExampleSentencesRes} from "@/common/types/aiRes/AiMakeExampleSentencesRes";
import UndoRedo from "@/common/utils/UndoRedo";
import {DpTask, DpTaskState} from "@/backend/db/tables/dpTask";
import {sleep, strBlank} from "@/common/utils/Util";
import usePlayerController from "@/fronted/hooks/usePlayerController";
import {AiAnalyseGrammarsRes} from "@/common/types/aiRes/AiAnalyseGrammarsRes";
import CustomMessage from "@/common/types/msg/interfaces/CustomMessage";
import HumanTopicMessage from "@/common/types/msg/HumanTopicMessage";
import AiWelcomeMessage from "@/common/types/msg/AiWelcomeMessage";
import HumanNormalMessage from "@/common/types/msg/HumanNormalMessage";
import {as} from "tencentcloud-sdk-nodejs";
import AiStreamMessage from "@/common/types/msg/AiStreamMessage";
import AiNormalMessage from "@/common/types/msg/AiNormalMessage";

const api = window.electron;

export type Topic = {
    content: string | {
        start: {
            sIndex: number;
            cIndex: number;
        },
        end: {
            sIndex: number;
            cIndex: number;
        }
    }

} | 'offscreen';

export type Tasks = {
    vocabularyTask: number | 'init' | 'done';
    phraseTask: number | 'init' | 'done';
    grammarTask: number | 'init' | 'done';
    sentenceTask: number | 'init' | 'done';
    chatTask: CustomMessage<any> | 'done';
}

const undoRedo = new UndoRedo<ChatPanelState>();

export type ChatPanelState = {
    tasks: Tasks;
    topic: Topic
    newVocabulary: AiAnalyseNewWordsRes;
    newPhrase: AiAnalyseNewPhrasesRes;
    newGrammar: AiAnalyseGrammarsRes;
    newSentence: AiMakeExampleSentencesRes;
    messages: CustomMessage<any>[];
    streamingMessage: CustomMessage<any> | null;
    canUndo: boolean;
    canRedo: boolean;
};

export type ChatPanelActions = {
    backward: () => void;
    forward: () => void;
    createTopic: (topic: Topic) => void;
    createFromCurrent: () => void;
    clear: () => void;
    setTask: (tasks: Tasks) => void;
    sent: (msg: string) => void;
};

const copy = (state: ChatPanelState): ChatPanelState => {
    return {
        tasks: {
            vocabularyTask: state.tasks.vocabularyTask,
            phraseTask: state.tasks.phraseTask,
            grammarTask: state.tasks.grammarTask,
            sentenceTask: state.tasks.sentenceTask,
            chatTask: state.tasks.chatTask
        },
        topic: state.topic,
        newVocabulary: state.newVocabulary,
        newPhrase: state.newPhrase,
        newGrammar: state.newGrammar,
        newSentence: state.newSentence,
        messages: state.messages,
        streamingMessage: state.streamingMessage,
        canUndo: state.canUndo,
        canRedo: state.canRedo,
    }
}

const empty = (): ChatPanelState => {
    return {
        tasks: {
            vocabularyTask: 'init',
            phraseTask: 'init',
            grammarTask: 'init',
            sentenceTask: 'init',
            chatTask: 'done'
        },
        topic: 'offscreen',
        newVocabulary: null,
        newPhrase: null,
        newGrammar: null,
        newSentence: null,
        messages: [],
        streamingMessage: null,
        canUndo: false,
        canRedo: false,
    }
}

const useChatPanel = create(
    subscribeWithSelector<ChatPanelState & ChatPanelActions>((set, get) => ({
        ...empty(),
        backward: () => {
            undoRedo.update(copy(get()));
            if (!undoRedo.canUndo()) return;
            set({
                ...copy(undoRedo.undo()),
                canUndo: undoRedo.canUndo(),
                canRedo: undoRedo.canRedo()
            })
        },
        forward: () => {
            undoRedo.update(copy(get()));
            if (!undoRedo.canRedo()) return;
            set({
                ...copy(undoRedo.redo()),
                canUndo: undoRedo.canUndo(),
                canRedo: undoRedo.canRedo()
            });

        },
        createTopic: async (topic: Topic) => {
            undoRedo.update(copy(get()));
            undoRedo.add(copy(get()));
            const text = extractTopic(topic);
            const synTask = await api.aiSynonymousSentence(text);
            const phraseGroupTask = await api.aiPhraseGroup(text);
            const tt = new HumanTopicMessage(text, phraseGroupTask);
            const mt = new AiWelcomeMessage({
                originalTopic: text,
                synonymousSentenceTask: synTask
            });
            set({
                ...empty(),
                topic: topic,
                messages: [
                    tt
                ],
                tasks: {
                    ...empty().tasks,
                    chatTask: mt
                },
                canRedo: undoRedo.canRedo(),
                canUndo: undoRedo.canUndo()
            });
        },
        createFromCurrent: async () => {
            undoRedo.add(copy(get()));
            const ct = usePlayerController.getState().currentSentence;
            const synTask = await api.aiSynonymousSentence(ct.text);
            const phraseGroupTask = await api.aiPhraseGroup(ct.text);
            const tt = new HumanTopicMessage(ct.text, phraseGroupTask);
            const mt = new AiWelcomeMessage({
                originalTopic: ct.text,
                synonymousSentenceTask: synTask
            });
            set({
                ...empty(),
                topic: {
                    content: {
                        start: {
                            sIndex: ct.index,
                            cIndex: 0
                        },
                        end: {
                            sIndex: ct.index,
                            cIndex: ct.text.length
                        }
                    }
                },
                messages: [
                    tt
                ],
                tasks: {
                    ...empty().tasks,
                    chatTask: mt
                }
            });
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
        },
        sent: async (msg: string) => {
            set({
                ...get(),
                messages: [
                    ...get().messages,
                    new HumanNormalMessage(msg)
                ]
            });
            const msgs = get().messages
                .flatMap(e => e.toMsg());
            const t = await api.chat(msgs);
            set({
                tasks: {
                    ...get().tasks,
                    chatTask: new AiStreamMessage(t)
                }
            });
        }
    }))
);

const extractTopic = (t: Topic): string => {
    if (t === 'offscreen') return 'offscreen';
    if (typeof t.content === 'string') return t.content;
    const content = t.content;
    const subtitle = usePlayerController.getState().subtitle;
    const length = subtitle?.length ?? 0;
    if (length === 0 || content.start.sIndex > length || content.end.sIndex > length) {
        return 'extractTopic failed';
    }
    let st = subtitle[content.start.sIndex].text;
    // from t.start.cIndex to end of st
    if (content.start.cIndex > 0 && content.start.cIndex <= st.length) {
        st = st.slice(content.start.cIndex);
    }
    let et = subtitle[content.end.sIndex].text;
    if (content.end.cIndex > 0 && content.end.cIndex <= et.length) {
        et = et.slice(0, content.end.cIndex);
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
        if (!tRes.result) return;
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
        if (!tRes.result) return;
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

const runGrammar = async () => {
    let tId = useChatPanel.getState().tasks.grammarTask;
    if (tId === 'done') return;
    if (tId === 'init') {
        tId = await api.aiAnalyzeGrammers(extractTopic(useChatPanel.getState().topic));
        useChatPanel.getState().setTask({
            ...useChatPanel.getState().tasks,
            grammarTask: tId
        });
    }
    const tRes: DpTask = await api.dpTaskDetail(tId);
    if (tRes.status === DpTaskState.IN_PROGRESS || tRes.status === DpTaskState.DONE) {
        if (!tRes.result) return;
        const res = JSON.parse(tRes.result) as AiAnalyseGrammarsRes;
        useChatPanel.setState({
            newGrammar: res
        });
    }
    if (tRes.status === DpTaskState.DONE) {
        useChatPanel.getState().setTask({
            ...useChatPanel.getState().tasks,
            grammarTask: 'done'
        });
    }
}

const runSentence = async () => {
    const state = useChatPanel.getState();
    let tId = state.tasks.sentenceTask;
    if (tId === 'done') return;
    if (state.tasks.phraseTask !== 'done' || state.tasks.vocabularyTask !== 'done') {
        console.log('phrase or vocabulary not done');
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
        if (!tRes.result) return;
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
    const tm = useChatPanel.getState().tasks.chatTask;
    if (tm === 'done') return;
    if (tm.msgType === 'ai-welcome') {
        const welcomeMessage = tm as AiWelcomeMessage;
        const synonymousSentence = await api.dpTaskDetail(welcomeMessage.synonymousSentenceTask);
        if (synonymousSentence.status === DpTaskState.IN_PROGRESS || synonymousSentence.status === DpTaskState.DONE) {
            if (!strBlank(synonymousSentence.result)) {
                welcomeMessage.synonymousSentenceTaskResp = JSON.parse(synonymousSentence.result);
                useChatPanel.setState({
                    streamingMessage: welcomeMessage.copy()
                });
            }
        }
        if (synonymousSentence.status === DpTaskState.DONE) {
            useChatPanel.getState().setTask({
                ...useChatPanel.getState().tasks,
                chatTask: 'done'
            });
        }
    }
    if (tm.msgType === 'ai-streaming') {
        const welcomeMessage = tm as AiStreamMessage;
        const synonymousSentence = await api.dpTaskDetail(welcomeMessage.taskId);
        if (synonymousSentence.status === DpTaskState.IN_PROGRESS || synonymousSentence.status === DpTaskState.DONE) {
            useChatPanel.setState({
                streamingMessage: new AiNormalMessage(synonymousSentence.result)
            });
        }
        if (synonymousSentence.status === DpTaskState.DONE) {
            useChatPanel.getState().setTask({
                ...useChatPanel.getState().tasks,
                chatTask: 'done'
            });
        }
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
            await runGrammar();
            await runSentence();
            await runChat();
            await sleep(100);
        }
    }
);


export default useChatPanel;
