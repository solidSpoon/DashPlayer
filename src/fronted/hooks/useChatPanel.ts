import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import UndoRedo from '@/common/utils/UndoRedo';
import { engEqual, p } from '@/common/utils/Util';
import { usePlayerV2 } from '@/fronted/hooks/usePlayerV2';
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
import StrUtil from '@/common/utils/str-util';
import { getRendererLogger } from '@/fronted/log/simple-logger';
import { TypeGuards } from '@/backend/utils/TypeGuards';
import { backendClient } from '@/fronted/application/bootstrap/backendClient';
import AiStreamingMessage from '@/common/types/msg/AiStreamingMessage';
import { ChatStreamEvent } from '@/common/types/chat';

const api = backendClient;

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
    chatSessionId: string;
    streamingMessageId: string | null;
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
    receiveChatStream: (event: ChatStreamEvent) => void;
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

const createChatSessionId = (): string => {
    if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
        return crypto.randomUUID();
    }
    return `chat-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
};

const copy = (state: ChatPanelState): ChatPanelState => {
    return {
        internal: {
            context: {
                ...state.internal.context
            },
            chatTaskQueue: state.internal.chatTaskQueue.map(e => e.copy())
        },
        chatSessionId: state.chatSessionId,
        streamingMessageId: state.streamingMessageId,
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
        chatSessionId: createChatSessionId(),
        streamingMessageId: null,
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
            api.call('chat/reset', { sessionId: get().chatSessionId }).then();
            undoRedo.update(copy(get()));
            undoRedo.add(empty());
            const synTask = await registerDpTask(() => api.call('ai-func/polish', text));
            const phraseGroupTask = await registerDpTask(() => api.call('ai-func/phrase-group', text));
            const tt = new HumanTopicMessage(get().topic, text, phraseGroupTask);
            const topic = { content: text };
            const currentSentence = usePlayerV2.getState().currentSentence;
            const sentences = usePlayerV2.getState().sentences;
            const subtitles = (() => {
                if (!currentSentence) return [] as typeof sentences;
                const idx = sentences.findIndex(s => s.index === currentSentence.index && s.fileHash === currentSentence.fileHash);
                const left = Math.max(0, idx - 5);
                const right = Math.min(sentences.length - 1, idx + 5);
                return sentences.slice(left, right + 1);
            })();
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
            api.call('chat/reset', { sessionId: get().chatSessionId }).then();
            undoRedo.add(copy(get()));
            const ct = usePlayerV2.getState().currentSentence;
            if (!ct) return;
            const synTask = await registerDpTask(() => api.call('ai-func/polish', ct.text ?? ''));
            const phraseGroupTask = await api.call('ai-func/phrase-group', ct.text ?? '');
            const tt = new HumanTopicMessage(get().topic, ct.text ?? '', phraseGroupTask);
            // const subtitleAround = usePlayerController.getState().getSubtitleAround(5).map(e => e.text);
            const url = useFile.getState().subtitlePath ?? '';
            getRendererLogger('useChatPanel').debug('subtitle file url', { url });
            const text = await fetch(UrlUtil.dp(url)).then((res) => res.text());
            getRendererLogger('useChatPanel').debug('subtitle file content', { length: text.length });
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
            const currentSentence = usePlayerV2.getState().currentSentence;
            if (!currentSentence) return;
            const sentences = usePlayerV2.getState().sentences;
            const subtitles = (() => {
                const idx = sentences.findIndex(s => s.index === currentSentence.index && s.fileHash === currentSentence.fileHash);
                const left = Math.max(0, idx - 5);
                const right = Math.min(sentences.length - 1, idx + 5);
                return sentences.slice(left, right + 1);
            })();
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
            api.call('chat/reset', { sessionId: get().chatSessionId }).then();
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
            getRendererLogger('useChatPanel').debug('chat history', { messageCount: history.length });
            const { messageId } = await api.call('chat/start', {
                sessionId: get().chatSessionId,
                messages: history
            });
            set({
                messages: [
                    ...get().messages,
                    requestMsg
                ],
                streamingMessage: new AiStreamingMessage(get().topic, messageId, '', true),
                streamingMessageId: messageId
            });
        },
        receiveChatStream: (event: ChatStreamEvent) => {
            if (event.sessionId !== get().chatSessionId) {
                return;
            }
            const currentStreaming = get().streamingMessage;
            if (event.event === 'start') {
                if (!currentStreaming || (currentStreaming as AiStreamingMessage).messageId !== event.messageId) {
                    set({
                        streamingMessage: new AiStreamingMessage(get().topic, event.messageId, '', true),
                        streamingMessageId: event.messageId
                    });
                }
                return;
            }

            if (!currentStreaming || (currentStreaming as AiStreamingMessage).messageId !== event.messageId) {
                return;
            }

            const streaming = currentStreaming as AiStreamingMessage;
            if (event.event === 'chunk') {
                set({
                    streamingMessage: streaming.withUpdate(`${streaming.content}${event.chunk ?? ''}`, true)
                });
                return;
            }
            if (event.event === 'done') {
                const finished = streaming.withUpdate(streaming.content, false);
                set({
                    messages: [...get().messages, finished],
                    streamingMessage: null,
                    streamingMessageId: null
                });
                return;
            }
            if (event.event === 'error') {
                const errorMsg = event.error ? `\n\n[Error] ${event.error}` : '\n\n[Error]';
                const failed = streaming.withUpdate(`${streaming.content}${errorMsg}`, false);
                set({
                    messages: [...get().messages, failed],
                    streamingMessage: null,
                    streamingMessageId: null
                });
            }
        },
        updateInternalContext: (value: string) => {
            get().internal.context.value = value;
            get().internal.context.time = Date.now();
        },
        ctxMenuOpened: () => {
            const internalContext = getInternalContext();
            getRendererLogger('useChatPanel').debug('context menu opened', { context: internalContext });
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
                const ct = usePlayerV2.getState().currentSentence;
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
    getRendererLogger('useChatPanel').debug('extract topic', { topic: t });
    if (t === 'offscreen') return 'offscreen';
    if (typeof t.content === 'string') return t.content;
    const content = t.content;
    const subtitle = usePlayerV2.getState().sentences;
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
    getRendererLogger('useChatPanel').debug('run sentence', { wordRegex: wr, phraseRegex: pr });
    if (!wr || !pr) return;
    const points = [
        ...(wr?.words ?? []).map(w => w.word),
        ...(pr?.phrases ?? []).map(p => p.phrase)
    ];
    getRendererLogger('useChatPanel').debug('extracted points', { count: points.length });
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
