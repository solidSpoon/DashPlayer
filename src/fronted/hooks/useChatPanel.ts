import {create} from 'zustand';
import {subscribeWithSelector} from 'zustand/middleware';
import {AiAnalyseNewWordsRes} from '@/common/types/aiRes/AiAnalyseNewWordsRes';
import {AiAnalyseNewPhrasesRes} from '@/common/types/aiRes/AiAnalyseNewPhrasesRes';
import {AiMakeExampleSentencesRes} from '@/common/types/aiRes/AiMakeExampleSentencesRes';
import UndoRedo from '@/common/utils/UndoRedo';
import {DpTask, DpTaskState} from '@/backend/db/tables/dpTask';
import {engEqual, p, sleep, strBlank, strNotBlank} from '@/common/utils/Util';
import usePlayerController from '@/fronted/hooks/usePlayerController';
import {AiAnalyseGrammarsRes} from '@/common/types/aiRes/AiAnalyseGrammarsRes';
import CustomMessage from '@/common/types/msg/interfaces/CustomMessage';
import HumanTopicMessage from '@/common/types/msg/HumanTopicMessage';
import AiWelcomeMessage from '@/common/types/msg/AiWelcomeMessage';
import HumanNormalMessage from '@/common/types/msg/HumanNormalMessage';
import useFile from '@/fronted/hooks/useFile';
import AiCtxMenuExplainSelectWithContextMessage from '@/common/types/msg/AiCtxMenuExplainSelectWithContextMessage';
import ChatRunner from '@/fronted/hooks/useChatPannel/runChat';
import {getTtsUrl, playAudioUrl} from '@/common/utils/AudioPlayer';
import AiCtxMenuPolishMessage from '@/common/types/msg/AiCtxMenuPolishMessage';
import AiCtxMenuExplainSelectMessage from '@/common/types/msg/AiCtxMenuExplainSelectMessage';

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
    internal: {
        context: {
            value: string;
            time: number;
        }
        chatTaskQueue: CustomMessage<any>[];
        newSentenceHistory: AiMakeExampleSentencesRes[];
    }
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
    context: string | null;
    input: string;
};

export type ChatPanelActions = {
    addChatTask: (task: CustomMessage<any>) => void;
    backward: () => void;
    forward: () => void;
    createFromSelect: (text?: string) => void;
    createFromCurrent: () => void;
    clear: () => void;
    setTask: (tasks: Tasks) => void;
    sent: (msg: string) => void;
    updateInternalContext: (value: string) => void;
    ctxMenuOpened: () => void;
    ctxMenuExplain: () => void;
    ctxMenuPlayAudio: () => void;
    ctxMenuPolish: () => void;
    ctxMenuQuote: () => void;
    ctxMenuCopy: () => void;
    deleteMessage: (msg: CustomMessage<any>) => void;
    retry: (type: 'vocabulary' | 'phrase' | 'grammar' | 'sentence' | 'topic' | 'welcome') => void;
    setInput: (input: string) => void;
};

const copy = (state: ChatPanelState): ChatPanelState => {
    return {
        internal: {
            context: {
                ...state.internal.context
            },
            chatTaskQueue: state.internal.chatTaskQueue.map(e => e.copy()),
            newSentenceHistory: state.internal.newSentenceHistory.map(e => ({
                ...e
            }))
        },
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
        context: state.context,
        input: state.input,
    };
};

const empty = (): ChatPanelState => {
    return {
        internal: {
            context: {
                value: null,
                time: 0
            },
            chatTaskQueue: [],
            newSentenceHistory: []
        },
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
        context: null,
        input: ''
    };
};

const useChatPanel = create(
    subscribeWithSelector<ChatPanelState & ChatPanelActions>((set, get) => ({
        ...empty(),
        addChatTask: (msg) => {
            get().internal.chatTaskQueue.push(msg);
        },
        backward: () => {
            undoRedo.update(copy(get()));
            if (!undoRedo.canUndo()) return;
            set({
                ...copy(undoRedo.undo()),
                canUndo: undoRedo.canUndo(),
                canRedo: undoRedo.canRedo()
            });
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
        createFromSelect: async (str: string) => {
            let text = str;
            if (strBlank(text)) {
                text = p(window.getSelection()?.toString());
                // 去除换行符
                text = text?.replace(/\n/g, '');
                if (strBlank(text)) {
                    text = useChatPanel.getState().context;
                }
                if (strBlank(text)) {
                    return;
                }
            }
            undoRedo.update(copy(get()));
            undoRedo.add(empty());
            const synTask = await api.call('ai-func/polish', text);
            const phraseGroupTask = await api.call('ai-func/phrase-group', text);
            const tt = new HumanTopicMessage(get().topic, text, phraseGroupTask);
            const topic = {content: text};
            const mt = new AiWelcomeMessage({
                originalTopic: text,
                synonymousSentenceTask: synTask,
                punctuationTask: null,
                topic: topic
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
            const synTask = await api.call('ai-func/polish', ct.text);
            const phraseGroupTask = await api.call('ai-func/phrase-group', ct.text);
            const tt = new HumanTopicMessage(get().topic, ct.text, phraseGroupTask);
            // const subtitleAround = usePlayerController.getState().getSubtitleAround(5).map(e => e.text);
            const url = useFile.getState().subtitleFile.objectUrl ?? '';
            const text = await fetch(url).then((res) => res.text());
            const punctuationTask = await api.call('ai-func/punctuation', {no: ct.indexInFile, srt: text});
            const topic = {
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
            };
            const mt = new AiWelcomeMessage({
                originalTopic: ct.text,
                synonymousSentenceTask: synTask,
                punctuationTask: punctuationTask,
                topic: topic
            });
            set({
                ...empty(),
                topic,
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
            get().addChatTask(new HumanNormalMessage(get().topic, msg));
        },
        updateInternalContext: (value: string) => {
            get().internal.context.value = value;
            get().internal.context.time = Date.now();
        },
        ctxMenuOpened: () => {
            const internalContext = getInternalContext();
            console.log('ctxMenuOpened', internalContext);
            set({
                context: internalContext
            });
        },
        ctxMenuExplain: async () => {
            const userSelect = window.getSelection().toString();
            if (strBlank(userSelect)) return;
            const context = get().context;
            if (strBlank(context) || engEqual(context, userSelect)) {
                const taskId = await api.call('ai-func/explain-select', {
                    word: userSelect
                });
                get().addChatTask(new AiCtxMenuExplainSelectMessage(taskId, get().topic, context));
            } else {
                const taskId = await api.call('ai-func/explain-select-with-context', {
                    sentence: context,
                    selectedWord: userSelect
                });
                get().addChatTask(new AiCtxMenuExplainSelectWithContextMessage(taskId, get().topic, context, userSelect));
            }
        },
        ctxMenuPlayAudio: async () => {
            let text = window.getSelection().toString();
            if (strBlank(text)) {
                text = get().context;
            }
            if (strBlank(text)) return;
            const ttsUrl = await getTtsUrl(text);
            await playAudioUrl(ttsUrl);
        },
        ctxMenuPolish: async () => {
            let text = window.getSelection().toString();
            if (strBlank(text)) {
                text = get().context;
            }
            if (strBlank(text)) return;
            const taskId = await api.call('ai-func/polish', text);
            get().addChatTask(new AiCtxMenuPolishMessage(taskId, get().topic, text));
        },
        deleteMessage: (msg: CustomMessage<any>) => {
            set({
                messages: get().messages.filter(e => e !== msg)
            });
        },
        retry: async (type: 'vocabulary' | 'phrase' | 'grammar' | 'sentence' | 'topic' | 'welcome') => {
            if (type === 'vocabulary') {
                get().setTask({
                    ...get().tasks,
                    vocabularyTask: 'init'
                });
            }
            if (type === 'phrase') {
                get().setTask({
                    ...get().tasks,
                    phraseTask: 'init'
                });
            }
            if (type === 'grammar') {
                get().setTask({
                    ...get().tasks,
                    grammarTask: 'init'
                });
            }
            if (type === 'topic') {
                const msg = get().messages[0].copy() as HumanTopicMessage;
                msg.phraseGroupTask = await api.call('ai-func/phrase-group', msg.content);
                // set 0
                const newMessages = [...get().messages]
                newMessages[0] = msg;
                set({
                    messages: newMessages
                });
            }
            if (type === 'welcome') {
                const msg = get().messages[1].copy() as AiWelcomeMessage;
                const ct = usePlayerController.getState().currentSentence;
                const polishTask = await api.call('ai-func/polish', msg.originalTopic);
                const punctuationTask = await api.call('ai-func/punctuation', {
                    no: ct.indexInFile,
                    srt: msg.originalTopic
                });
                msg.polishTask = polishTask;
                msg.punctuationTask = punctuationTask;

            }
            if (type === 'sentence') {
                get().internal.newSentenceHistory.push(get().newSentence);
                get().setTask({
                    ...get().tasks,
                    sentenceTask: 'init'
                });
            }
        },
        ctxMenuQuote: () => {
            let text = window.getSelection().toString();
            if (strBlank(text)) {
                text = get().context;
            }
            if (strBlank(text)) return;
            text = '<context>\n' + text.trim() + '\n</context>\n\n';
            if (strNotBlank(get().input)) {
                text = get().input + '\n' + text;
            }
            set({
                input: text
            });

        },
        ctxMenuCopy: async () => {
            let text = window.getSelection().toString();
            if (strBlank(text)) {
                text = get().context;
            }
            if (strBlank(text)) return;
            await navigator.clipboard.writeText(text);
        },
        setInput: (input: string) => {
            set({
                input
            });
        }
    }))
);

export function getInternalContext(): string | null {
    const context = useChatPanel.getState().internal.context;
    if (!context) return null;
    // 0.5s
    if (Math.abs(Date.now() - context.time) > 500) {
        return null;
    }
    return context.value;
}


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
};


const runVocabulary = async () => {
    let tId = useChatPanel.getState().tasks.vocabularyTask;
    if (tId === 'done') return;
    if (tId === 'init') {
        tId = await api.call('ai-func/analyze-new-words', extractTopic(useChatPanel.getState().topic));
        useChatPanel.getState().setTask({
            ...useChatPanel.getState().tasks,
            vocabularyTask: tId
        });
    }
    const tRes: DpTask = await api.call('dp-task/detail', tId);
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
};

const runPhrase = async () => {
    let tId = useChatPanel.getState().tasks.phraseTask;
    if (tId === 'done') return;
    if (tId === 'init') {
        tId = await api.call('ai-func/analyze-new-phrases', extractTopic(useChatPanel.getState().topic));
        useChatPanel.getState().setTask({
            ...useChatPanel.getState().tasks,
            phraseTask: tId
        });
    }
    const tRes: DpTask = await api.call('dp-task/detail', tId);
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
};

const runGrammar = async () => {
    let tId = useChatPanel.getState().tasks.grammarTask;
    if (tId === 'done') return;
    if (tId === 'init') {
        tId = await api.call('ai-func/analyze-grammars', extractTopic(useChatPanel.getState().topic));
        useChatPanel.getState().setTask({
            ...useChatPanel.getState().tasks,
            grammarTask: tId
        });
    }
    const tRes: DpTask = await api.call('dp-task/detail', tId);
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
};

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
    ];
    if (tId === 'init') {
        tId = await api.call('ai-func/make-example-sentences', {
            sentence: extractTopic(useChatPanel.getState().topic),
            point: points
        });
        useChatPanel.getState().setTask({
            ...useChatPanel.getState().tasks,
            sentenceTask: tId
        });
    }
    const tRes: DpTask = await api.call('dp-task/detail', tId);
    if (tRes.status === DpTaskState.IN_PROGRESS || tRes.status === DpTaskState.DONE) {
        if (!tRes.result) return;
        const res = JSON.parse(tRes.result) as AiMakeExampleSentencesRes;
        useChatPanel.setState({
            newSentence: {
                ...res
            }
        });
    }
    if (tRes.status === DpTaskState.DONE) {
        useChatPanel.getState().setTask({
            ...useChatPanel.getState().tasks,
            sentenceTask: 'done'
        });
    }
};

let running = false;
useChatPanel.subscribe(
    (s) => s.topic,
    async (topic) => {
        if (topic === 'offscreen') {
            return;
        }
        if (running) return;
        running = true;
        while (useChatPanel.getState().topic !== 'offscreen') {
            console.log('running', useChatPanel.getState().topic);
            await runVocabulary();
            await runPhrase();
            await runGrammar();
            await runSentence();
            await ChatRunner.runChat();
            await sleep(100);
            if (useChatPanel.getState().tasks.chatTask === 'done') {
                if (useChatPanel.getState().internal.chatTaskQueue.length > 0) {
                    const task = useChatPanel.getState().internal.chatTaskQueue.shift();
                    useChatPanel.getState().setTask({
                        ...useChatPanel.getState().tasks,
                        chatTask: task
                    });
                }
            }
        }
        running = false;
    }
);


export default useChatPanel;
