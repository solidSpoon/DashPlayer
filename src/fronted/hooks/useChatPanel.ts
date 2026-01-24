import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import UndoRedo from '@/common/utils/UndoRedo';
import { engEqual, p } from '@/common/utils/Util';
import { usePlayerV2 } from '@/fronted/hooks/usePlayerV2';
import CustomMessage from '@/common/types/msg/interfaces/CustomMessage';
import HumanTopicMessage from '@/common/types/msg/HumanTopicMessage';
import HumanNormalMessage from '@/common/types/msg/HumanNormalMessage';
import useFile from '@/fronted/hooks/useFile';
import AiCtxMenuExplainSelectWithContextMessage from '@/common/types/msg/AiCtxMenuExplainSelectWithContextMessage';
import { getTtsUrl, playAudioUrl } from '@/common/utils/AudioPlayer';
import AiCtxMenuPolishMessage from '@/common/types/msg/AiCtxMenuPolishMessage';
import AiCtxMenuExplainSelectMessage from '@/common/types/msg/AiCtxMenuExplainSelectMessage';
import UrlUtil from '@/common/utils/UrlUtil';
import { registerDpTask } from '@/fronted/hooks/useDpTaskCenter';
import StrUtil from '@/common/utils/str-util';
import { getRendererLogger } from '@/fronted/log/simple-logger';
import { TypeGuards } from '@/backend/utils/TypeGuards';
import { backendClient } from '@/fronted/application/bootstrap/backendClient';
import AiStreamingMessage from '@/common/types/msg/AiStreamingMessage';
import { ChatStreamEvent, ChatWelcomeParams } from '@/common/types/chat';
import { AnalysisStreamEvent } from '@/common/types/analysis';
import { AiUnifiedAnalysisRes } from '@/common/types/aiRes/AiUnifiedAnalysisRes';
import { DeepPartial } from '@/common/types/analysis';

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
    analysis: Partial<AiUnifiedAnalysisRes> | null;
    analysisMessageId: string | null;
    analysisStatus: 'idle' | 'streaming' | 'done' | 'error';
    analysisError: string | null;
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
    sent: (msg: string) => void;
    receiveChatStream: (event: ChatStreamEvent) => void;
    receiveAnalysisStream: (event: AnalysisStreamEvent) => void;
    startAnalysis: () => Promise<void>;
    updateInternalContext: (value: string) => void;
    ctxMenuOpened: () => void;
    ctxMenuExplain: () => void;
    ctxMenuPlayAudio: () => void;
    ctxMenuPolish: () => void;
    ctxMenuQuote: () => void;
    ctxMenuCopy: () => void;
    deleteMessage: (msg: CustomMessage<any>) => void;
    retry: (type: 'analysis' | 'topic') => void;
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
        analysis: state.analysis,
        analysisMessageId: state.analysisMessageId,
        analysisStatus: state.analysisStatus,
        analysisError: state.analysisError,
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
        analysis: null,
        analysisMessageId: null,
        analysisStatus: 'idle',
        analysisError: null,
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
            const tt = new HumanTopicMessage(get().topic, text);
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
            set({
                ...empty(),
                topic: topic,
                messages: [
                    tt
                ],
                canRedo: undoRedo.canRedo(),
                canUndo: undoRedo.canUndo()
            });
            scheduleWelcomeMessage({
                sessionId: get().chatSessionId,
                originalTopic: text,
                fullText: context.join(' '),
            }, topic);
        },
        createFromCurrent: async () => {
            api.call('chat/reset', { sessionId: get().chatSessionId }).then();
            undoRedo.add(copy(get()));
            const ct = usePlayerV2.getState().currentSentence;
            if (!ct) return;
            const tt = new HumanTopicMessage(get().topic, ct.text ?? '');
            // const subtitleAround = usePlayerController.getState().getSubtitleAround(5).map(e => e.text);
            const url = useFile.getState().subtitlePath ?? '';
            getRendererLogger('useChatPanel').debug('subtitle file url', { url });
            const text = await fetch(UrlUtil.dp(url)).then((res) => res.text());
            getRendererLogger('useChatPanel').debug('subtitle file content', { length: text.length });
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
            set({
                ...empty(),
                topic,
                messages: [
                    tt
                ]
            });
            scheduleWelcomeMessage({
                sessionId: get().chatSessionId,
                originalTopic: ct.text,
                fullText: subtitles.map(e => e.text).join(' '),
            }, topic);
        },
        clear: () => {
            undoRedo.clear();
            api.call('chat/reset', { sessionId: get().chatSessionId }).then();
            set(empty());
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
        receiveAnalysisStream: (event: AnalysisStreamEvent) => {
            if (event.sessionId !== get().chatSessionId) {
                return;
            }
            if (event.event === 'start') {
                set({
                    analysis: {},
                    analysisMessageId: event.messageId,
                    analysisStatus: 'streaming',
                    analysisError: null,
                });
                return;
            }

            if (event.messageId !== get().analysisMessageId) {
                return;
            }

            if (event.event === 'chunk' && event.partial) {
                set({
                    analysis: mergeAnalysisPartial(get().analysis ?? {}, event.partial),
                    analysisStatus: 'streaming',
                });
                return;
            }
            if (event.event === 'done') {
                set({
                    analysisStatus: 'done',
                });
                return;
            }
            if (event.event === 'error') {
                set({
                    analysisStatus: 'error',
                    analysisError: event.error ?? 'analysis error',
                });
            }
        },
        startAnalysis: async () => {
            const text = extractTopic(get().topic);
            if (StrUtil.isBlank(text) || text === 'offscreen') {
                return;
            }
            const { messageId } = await api.call('analysis/start', {
                sessionId: get().chatSessionId,
                text,
            });
            set({
                analysis: {},
                analysisMessageId: messageId,
                analysisStatus: 'streaming',
                analysisError: null,
            });
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
        retry: async (type: 'analysis' | 'topic') => {
            if (type === 'analysis' || type === 'topic') {
                get().startAnalysis();
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

const mergeAnalysisPartial = (
    current: Partial<AiUnifiedAnalysisRes>,
    partial: DeepPartial<AiUnifiedAnalysisRes>
): Partial<AiUnifiedAnalysisRes> => {
    const mergeValue = (base: unknown, update: unknown): unknown => {
        if (Array.isArray(base) || Array.isArray(update)) {
            const baseArr = Array.isArray(base) ? base : [];
            const updateArr = Array.isArray(update) ? update : [];
            const length = Math.max(baseArr.length, updateArr.length);
            return Array.from({ length }).map((_, index) => {
                if (index in updateArr) {
                    return mergeValue(baseArr[index], updateArr[index]);
                }
                return baseArr[index];
            });
        }
        if (base && typeof base === 'object' && update && typeof update === 'object') {
            const result: Record<string, unknown> = { ...(base as Record<string, unknown>) };
            Object.entries(update as Record<string, unknown>).forEach(([key, value]) => {
                result[key] = mergeValue(result[key], value);
            });
            return result;
        }
        if (update !== undefined) {
            return update;
        }
        return base;
    };

    return mergeValue(current, partial) as Partial<AiUnifiedAnalysisRes>;
};


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

const scheduleWelcomeMessage = (params: ChatWelcomeParams, topic: Topic) => {
    api.call('chat/welcome', params)
        .then(({ messageId }) => {
            if (useChatPanel.getState().chatSessionId !== params.sessionId) {
                return;
            }
            const nextMessages = useChatPanel.getState().messages
                .filter(msg => msg.msgType !== 'ai-welcome' && msg.msgType !== 'ai-streaming');
            useChatPanel.setState({
                messages: nextMessages,
                streamingMessage: new AiStreamingMessage(topic, messageId, '', true),
                streamingMessageId: messageId,
            });
        })
        .catch((error) => {
            getRendererLogger('useChatPanel').error('failed to stream welcome message', { error });
        });
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
        await useChatPanel.getState().startAnalysis();
        running = false;
    }
);
export default useChatPanel;
