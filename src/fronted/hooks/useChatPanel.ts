import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import UndoRedo from '@/common/utils/UndoRedo';
import { engEqual, p } from '@/common/utils/Util';
import usePlayerController from '@/fronted/hooks/usePlayerController';
import CustomMessage from '@/common/types/msg/interfaces/CustomMessage';
import HumanTopicMessage from '@/common/types/msg/HumanTopicMessage';
import AiWelcomeMessage from '@/common/types/msg/AiWelcomeMessage';
import HumanNormalMessage from '@/common/types/msg/HumanNormalMessage';
import useFile from '@/fronted/hooks/useFile';
import AiCtxMenuExplainSelectWithContextMessage from '@/common/types/msg/AiCtxMenuExplainSelectWithContextMessage';
import { getTtsUrl, playAudioUrl } from '@/common/utils/AudioPlayer';
import AiCtxMenuPolishMessage from '@/common/types/msg/AiCtxMenuPolishMessage';
import AiCtxMenuExplainSelectMessage from '@/common/types/msg/AiCtxMenuExplainSelectMessage';
import UrlUtil from '@/common/utils/UrlUtil';
import { getDpTaskResult, registerDpTask } from '@/fronted/hooks/useDpTaskCenter';
import { AiAnalyseNewWordsRes } from '@/common/types/aiRes/AiAnalyseNewWordsRes';
import { AiAnalyseNewPhrasesRes } from '@/common/types/aiRes/AiAnalyseNewPhrasesRes';
import AiNormalMessage from '@/common/types/msg/AiNormalMessage';
import StrUtil from '@/common/utils/str-util';
import { TypeGuards } from '@/backend/utils/TypeGuards';

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
    vocabularyTask: number | null;
    phraseTask: number | null;
    grammarTask: number | null;
    sentenceTask: number[];
}

const undoRedo = new UndoRedo<ChatPanelState>();
export type ChatPanelState = {
    internal: {
        context: {
            value: string | null;
            time: number;
        }
        chatTaskQueue: CustomMessage<any>[];
    }
    tasks: Tasks;
    topic: Topic
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
            chatTaskQueue: state.internal.chatTaskQueue.map(e => e.copy())
        },
        tasks: {
            vocabularyTask: state.tasks.vocabularyTask,
            phraseTask: state.tasks.phraseTask,
            grammarTask: state.tasks.grammarTask,
            sentenceTask: state.tasks.sentenceTask
        },
        topic: state.topic,
        messages: state.messages,
        streamingMessage: state.streamingMessage,
        canUndo: state.canUndo,
        canRedo: state.canRedo,
        context: state.context,
        input: state.input
    };
};

const empty = (): ChatPanelState => {
    return {
        internal: {
            context: {
                value: null,
                time: 0
            },
            chatTaskQueue: []
        },
        tasks: {
            vocabularyTask: null,
            phraseTask: null,
            grammarTask: null,
            sentenceTask: []
        },
        topic: 'offscreen',
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
            set({
                messages: [
                    ...get().messages,
                    msg
                ]
            });
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
        createFromSelect: async (str?: string) => {
            let text = str;
            if (StrUtil.isBlank(text)) {
                text = p(window.getSelection()?.toString());
                // 去除换行符
                text = text?.replace(/\n/g, '');
                if (StrUtil.isBlank(text)) {
                    text = useChatPanel.getState().context ?? '';
                }
                if (StrUtil.isBlank(text)) {
                    return;
                }
            }
            undoRedo.update(copy(get()));
            undoRedo.add(empty());
            const synTask = await registerDpTask(() => api.call('ai-func/polish', text));
            const phraseGroupTask = await registerDpTask(() => api.call('ai-func/phrase-group', text));
            const tt = new HumanTopicMessage(get().topic, text, phraseGroupTask);
            const topic = { content: text };
            const currentSentence = usePlayerController.getState().currentSentence;
            const subtitles = usePlayerController.getState().getSubtitleAround(currentSentence?.index ?? 0, 5);
            const context: string[] = subtitles
                .filter(TypeGuards.isNotNull)
                .map(e => e.text ?? '');
            const transTask = await registerDpTask(() => api.call('ai-func/translate-with-context', {
                sentence: text??'',
                context: context
            }));
            const mt = new AiWelcomeMessage({
                originalTopic: text,
                synonymousSentenceTask: synTask,
                punctuationTask: null,
                topic: topic,
                translateTask: transTask
            });
            set({
                ...empty(),
                topic: topic,
                messages: [
                    tt,
                    mt
                ],
                tasks: {
                    ...empty().tasks
                    // chatTask: mt
                },
                canRedo: undoRedo.canRedo(),
                canUndo: undoRedo.canUndo()
            });
        },
        createFromCurrent: async () => {
            undoRedo.add(copy(get()));
            const ct = usePlayerController.getState().currentSentence;
            if (!ct) return;
            const synTask = await registerDpTask(() => api.call('ai-func/polish', ct.text ?? ''));
            const phraseGroupTask = await api.call('ai-func/phrase-group', ct.text ?? '');
            const tt = new HumanTopicMessage(get().topic, ct.text ?? '', phraseGroupTask);
            // const subtitleAround = usePlayerController.getState().getSubtitleAround(5).map(e => e.text);
            const url = useFile.getState().subtitlePath ?? '';
            console.log(url);
            const text = await fetch(UrlUtil.dp(url)).then((res) => res.text());
            console.log('text', text);
            const punctuationTask = await registerDpTask(() => api.call('ai-func/punctuation', {
                no: ct.index,
                srt: text
            }));
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
            const currentSentence = usePlayerController.getState().currentSentence;
            if (!currentSentence) return;
            const subtitles = usePlayerController.getState().getSubtitleAround(currentSentence.index, 5);
            const transTask = await registerDpTask(() => api.call('ai-func/translate-with-context', {
                sentence: currentSentence.text,
                context: subtitles.map(e => e.text)
            }));
            const mt = new AiWelcomeMessage({
                originalTopic: ct.text,
                synonymousSentenceTask: synTask,
                punctuationTask: punctuationTask,
                topic: topic,
                translateTask: transTask
            });
            set({
                ...empty(),
                topic,
                messages: [
                    tt,
                    mt
                ],
                tasks: {
                    ...empty().tasks
                    // chatTask: mt
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
            if (StrUtil.isBlank(msg)) return;
            const requestMsg = new HumanNormalMessage(get().topic, msg);
            const history = await Promise.all(
                get().messages.concat(requestMsg).map(e => e.toMsg())
            ).then(results => results.flat());
            console.log('history', history);
            const taskID = await registerDpTask(() => api.call('ai-func/chat', { msgs: history }));
            set({
                messages: [
                    ...get().messages,
                    requestMsg,
                    new AiNormalMessage(get().topic, taskID)
                ]
            });
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
            const userSelect = window.getSelection()?.toString() ?? '';
            if (StrUtil.isBlank(userSelect)) return;
            const context = get().context;
            if (StrUtil.isBlank(context) || engEqual(context, userSelect)) {
                const taskId = await registerDpTask(() => api.call('ai-func/explain-select', {
                    word: userSelect
                }));
                get().addChatTask(new AiCtxMenuExplainSelectMessage(taskId, get().topic, context ?? ''));
            } else {
                const taskId = await registerDpTask(() => api.call('ai-func/explain-select-with-context', {
                    sentence: context,
                    selectedWord: userSelect
                }));
                get().addChatTask(new AiCtxMenuExplainSelectWithContextMessage(taskId, get().topic, context, userSelect));
            }
        },
        ctxMenuPlayAudio: async () => {
            let text: string | null = window.getSelection()?.toString() ?? '';
            if (StrUtil.isBlank(text)) {
                text = get().context;
            }
            if (StrUtil.isBlank(text)) return;
            const ttsUrl = await getTtsUrl(text);
            await playAudioUrl(ttsUrl);
        },
        ctxMenuPolish: async () => {
            let text = window.getSelection()?.toString() ?? '';
            if (StrUtil.isBlank(text)) {
                text = get().context ?? '';
            }
            if (StrUtil.isBlank(text)) return;
            const taskId = await registerDpTask(() => api.call('ai-func/polish', text));
            get().addChatTask(new AiCtxMenuPolishMessage(taskId, get().topic, text));
        },
        deleteMessage: (msg: CustomMessage<any>) => {
            set({
                messages: get().messages.filter(e => e !== msg)
            });
        },
        retry: async (type: 'vocabulary' | 'phrase' | 'grammar' | 'sentence' | 'topic' | 'welcome') => {
            if (type === 'vocabulary') {
                runVocabulary().then();
            }
            if (type === 'phrase') {
                runPhrase().then();
            }
            if (type === 'grammar') {
                runGrammar().then();
            }
            if (type === 'topic') {
                const msg = get().messages[0].copy() as HumanTopicMessage;
                msg.phraseGroupTask = await registerDpTask(() => api.call('ai-func/phrase-group', msg.content));
                // set 0
                const newMessages = [...get().messages];
                newMessages[0] = msg;
                set({
                    messages: newMessages
                });
            }
            if (type === 'welcome') {
                const msg = get().messages[1].copy() as AiWelcomeMessage;
                const ct = usePlayerController.getState().currentSentence;
                if (!ct) return;
                const polishTask = await registerDpTask(() => api.call('ai-func/polish', msg.originalTopic));
                const punctuationTask = await registerDpTask(() => api.call('ai-func/punctuation', {
                    no: ct.index,
                    srt: msg.originalTopic
                }));
                msg.polishTask = polishTask;
                msg.punctuationTask = punctuationTask;
                // todo
            }
            if (type === 'sentence') {
                runSentence(true).then();
            }
        },
        ctxMenuQuote: () => {
            let text: string | null = window.getSelection()?.toString() ?? '';
            if (StrUtil.isBlank(text)) {
                text = get().context;
            }
            if (StrUtil.isBlank(text)) return;
            text = '<context>\n' + text.trim() + '\n</context>\n\n';
            if (StrUtil.isNotBlank(get().input)) {
                text = get().input + '\n' + text;
            }
            set({
                input: text
            });

        },
        ctxMenuCopy: async () => {
            let text: string | null = window.getSelection()?.toString() ?? '';
            if (StrUtil.isBlank(text)) {
                text = get().context;
            }
            if (StrUtil.isBlank(text)) return;
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
    console.log('extractTopic', t);
    if (t === 'offscreen') return 'offscreen';
    if (typeof t.content === 'string') return t.content;
    const content = t.content;
    const subtitle = usePlayerController.getState().subtitle;
    const length = subtitle?.length ?? 0;
    if (length === 0 || content.start.sIndex > length || content.end.sIndex > length) {
        return 'extractTopic failed';
    }
    let st = subtitle[content.start.sIndex].text;
    if (content.start.sIndex === content.end.sIndex) {
        if (content.start.cIndex > 0 && content.end.cIndex <= st.length && content.start.cIndex < content.end.cIndex) {
            st = st.slice(content.start.cIndex, content.end.cIndex);
        }
        return st;
    }
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
    const tId = await registerDpTask(() => api.call('ai-func/analyze-new-words', extractTopic(useChatPanel.getState().topic)), {
        onFinish: (res) => {
            runSentence().then();
        }
    });
    useChatPanel.getState().setTask({
        ...useChatPanel.getState().tasks,
        vocabularyTask: tId
    });
};

const runPhrase = async () => {
    const tId = await registerDpTask(() => api.call('ai-func/analyze-new-phrases', extractTopic(useChatPanel.getState().topic)), {
        onFinish: (res) => {
            runSentence().then();
        }
    });
    useChatPanel.getState().setTask({
        ...useChatPanel.getState().tasks,
        phraseTask: tId
    });

};

const runGrammar = async () => {
    const tId = await registerDpTask(() => api.call('ai-func/analyze-grammars', extractTopic(useChatPanel.getState().topic)));
    useChatPanel.getState().setTask({
        ...useChatPanel.getState().tasks,
        grammarTask: tId
    });

};

let runSentenceLock = 0;

const runSentence = async (force = false) => {
    const state = useChatPanel.getState();
    const wtId = state.tasks.vocabularyTask;
    const ptId = state.tasks.phraseTask;
    const wr = await getDpTaskResult<AiAnalyseNewWordsRes>(typeof wtId === 'number' ? wtId : null);
    const pr = await getDpTaskResult<AiAnalyseNewPhrasesRes>(typeof ptId === 'number' ? ptId : null);
    console.log('runSentence', wr, pr);
    if (!wr || !pr) return;
    const points = [
        ...(wr?.words ?? []).map(w => w.word),
        ...(pr?.phrases ?? []).map(p => p.phrase)
    ];
    console.log('points', points);
    const newLock = (typeof wtId === 'number' ? wtId : 0) + (typeof ptId === 'number' ? ptId : 0);
    if (runSentenceLock !== newLock || force) {
        runSentenceLock = newLock;
        const tId = await registerDpTask(() => api.call('ai-func/make-example-sentences', {
            sentence: extractTopic(useChatPanel.getState().topic),
            point: points
        }));
        useChatPanel.getState().setTask({
            ...useChatPanel.getState().tasks,
            sentenceTask: [...useChatPanel.getState().tasks.sentenceTask, tId]
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
        const tasks = useChatPanel.getState().tasks;
        if (!tasks.vocabularyTask) {
            await runVocabulary();
        }
        if (!tasks.phraseTask) {
            await runPhrase();
        }
        if (!tasks.grammarTask) {
            await runGrammar();
        }
        running = false;
    }
);
export default useChatPanel;
