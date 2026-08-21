/**
 * 管理播放器聊天面板的会话、消息流、分析结果和上下文操作。
 */
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import UndoRedo from '@/common/utils/UndoRedo';
import { engEqual, p } from '@/common/utils/Util';
import { usePlayer } from '@/fronted/features/player/playerStore';
import useFile from '@/fronted/features/file-browser/fileStore';
import { getTtsUrl, playAudioUrl } from '@/fronted/infrastructure/audio/AudioPlayer';
import StrUtil from '@/common/utils/str-util';
import { getRendererLogger } from '@/fronted/log/simple-logger';
import { TypeGuards } from '@/common/utils/TypeGuards';
import { chatApi } from '@/fronted/features/chat/chatApi';
import { Topic } from '@/common/types/chat';
import { AnalysisStreamEvent, DeepPartial } from '@/common/types/analysis';
import { AiUnifiedAnalysisRes } from '@/common/types/aiRes/AiUnifiedAnalysisRes';

const undoRedo = new UndoRedo<ChatPanelState>();

/** 整句学习面板中需要跨组件共享和撤销恢复的状态。 */
export type ChatPanelState = {
    /** 仅供右键菜单在短时间内读取的内部上下文。 */
    internal: {
        /** 最近一次被业务组件标记的文本及标记时间。 */
        context: {
            /** 被标记的原始文本。 */
            value: string | null;
            /** 标记时间，Unix 毫秒。 */
            time: number;
        }
    }
    /** 后端整句学习会话 ID；空字符串表示当前没有会话。 */
    chatSessionId: string;
    /** 创建会话时冻结的主题原文。 */
    topicText: string;
    /** 由上下文菜单排队、等待聊天组件发送的追问。 */
    queuedMessage: { id: number; content: string } | null;
    /** 流式合并中的句子分析结果。 */
    analysis: Partial<AiUnifiedAnalysisRes> | null;
    /** 当前分析请求的消息 ID，用于过滤过期事件。 */
    analysisMessageId: string | null;
    /** 当前句子分析生命周期状态。 */
    analysisStatus: 'idle' | 'streaming' | 'done' | 'error';
    /** 分析失败时返回的显式错误信息。 */
    analysisError: string | null;
    /** 当前学习主题的字幕位置或直接文本。 */
    topic: Topic
    /** 是否可以撤销到上一个学习主题。 */
    canUndo: boolean;
    /** 是否可以重做到下一个学习主题。 */
    canRedo: boolean;
    /** 右键菜单打开时冻结的操作上下文。 */
    context: string | null;
    /** 受控聊天输入框文本。 */
    input: string;
};

/** 整句学习面板对外暴露的状态操作。 */
export type ChatPanelActions = {
    backward: () => void;
    forward: () => void;
    createFromSelect: (text?: string) => Promise<void>;
    createFromCurrent: () => void;
    clear: () => void;
    sent: (msg: string) => void;
    receiveAnalysisStream: (event: AnalysisStreamEvent) => void;
    startAnalysis: () => Promise<void>;
    updateInternalContext: (value: string) => void;
    ctxMenuOpened: () => void;
    ctxMenuExplain: () => void;
    ctxMenuPlayAudio: () => void;
    ctxMenuPolish: () => void;
    ctxMenuQuote: () => void;
    ctxMenuCopy: () => void;
    retry: (type: 'analysis' | 'topic') => void;
    setInput: (input: string) => void;
    consumeQueuedMessage: (id: number) => void;
};

/**
 * 创建可交给撤销栈保存的状态副本。
 * @param state 当前面板状态。
 * @returns 与外部可变引用隔离的状态副本。
 */
const copy = (state: ChatPanelState): ChatPanelState => {
    return {
        internal: {
            context: {
                ...state.internal.context
            },
        },
        chatSessionId: state.chatSessionId,
        topicText: state.topicText,
        queuedMessage: state.queuedMessage,
        analysis: state.analysis,
        analysisMessageId: state.analysisMessageId,
        analysisStatus: state.analysisStatus,
        analysisError: state.analysisError,
        topic: state.topic,
        canUndo: state.canUndo,
        canRedo: state.canRedo,
        context: state.context,
        input: state.input
    };
};

/**
 * 创建没有活动会话的初始面板状态。
 * @returns 全字段显式初始化的空状态。
 */
const empty = (): ChatPanelState => {
    return {
        internal: {
            context: {
                value: null,
                time: 0
            },
        },
        chatSessionId: '',
        topicText: '',
        queuedMessage: null,
        analysis: null,
        analysisMessageId: null,
        analysisStatus: 'idle',
        analysisError: null,
        topic: 'offscreen',
        canUndo: false,
        canRedo: false,
        context: null,
        input: ''
    };
};

/**
 * 在新建主题后启动分析请求。
 * 这里显式限制为“创建新会话”场景触发，避免前进/后退恢复历史状态时重复请求。
 */
const startAnalysisForTopic = async () => {
    await useChatPanel.getState().startAnalysis();
};

// 流式分析 chunk 计数：仅在收到 start 时归零，用于节流 chunk 级调试日志。
let analysisStreamChunkCount = 0;

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
            const topic = { content: text };
            const currentSentence = usePlayer.getState().currentSentence;
            const sentences = usePlayer.getState().sentences;
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
            const videoId = useFile.getState().videoId;
            if (!videoId) {
                throw new Error('当前视频 ID 不存在，无法创建整句学习会话');
            }
            if (!currentSentence) {
                throw new Error('当前字幕句不存在，无法创建带上下文工具的整句学习会话');
            }
            const previousSessionId = get().chatSessionId;
            if (previousSessionId) {
                chatApi.closeSession(previousSessionId).catch((error) => {
                    getRendererLogger('useChatPanel').error('failed to close previous chat session', { error });
                });
            }
            const { sessionId } = await chatApi.createSession({
                videoId,
                originalTopic: text,
                paragraphLines: context,
                subtitleFileHash: currentSentence.fileHash,
                anchorSentenceIndex: currentSentence.index,
            });
            set({
                ...empty(),
                chatSessionId: sessionId,
                topicText: text,
                topic: topic,
                canRedo: undoRedo.canRedo(),
                canUndo: undoRedo.canUndo()
            });
            startAnalysisForTopic().catch((error) => {
                getRendererLogger('useChatPanel').error('failed to start analysis for selected topic', { error });
            });
        },
        createFromCurrent: async () => {
            undoRedo.add(copy(get()));
            const ct = usePlayer.getState().currentSentence;
            if (!ct) return;
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
            const currentSentence = usePlayer.getState().currentSentence;
            if (!currentSentence) return;
            const sentences = usePlayer.getState().sentences;
            const subtitles = (() => {
                const idx = sentences.findIndex(s => s.index === currentSentence.index && s.fileHash === currentSentence.fileHash);
                const left = Math.max(0, idx - 5);
                const right = Math.min(sentences.length - 1, idx + 5);
                return sentences.slice(left, right + 1);
            })();
            const videoId = useFile.getState().videoId;
            if (!videoId) {
                throw new Error('当前视频 ID 不存在，无法创建整句学习会话');
            }
            const previousSessionId = get().chatSessionId;
            if (previousSessionId) {
                chatApi.closeSession(previousSessionId).catch((error) => {
                    getRendererLogger('useChatPanel').error('failed to close previous chat session', { error });
                });
            }
            const paragraphLines = subtitles.map(e => e.text);
            const { sessionId } = await chatApi.createSession({
                videoId,
                originalTopic: ct.text,
                paragraphLines,
                subtitleFileHash: ct.fileHash,
                anchorSentenceIndex: ct.index,
            });
            set({
                ...empty(),
                chatSessionId: sessionId,
                topicText: ct.text,
                topic,
            });
            startAnalysisForTopic().catch((error) => {
                getRendererLogger('useChatPanel').error('failed to start analysis for current topic', { error });
            });
        },
        clear: () => {
            const sessionId = get().chatSessionId;
            if (sessionId) {
                chatApi.closeSession(sessionId).catch((error) => {
                    getRendererLogger('useChatPanel').error('failed to close chat session', { error });
                });
            }
            undoRedo.clear();
            set(empty());
        },
        sent: async (msg: string) => {
            if (StrUtil.isBlank(msg)) return;
            set({
                queuedMessage: {
                    id: Date.now(),
                    content: msg,
                },
            });
        },
        receiveAnalysisStream: (event: AnalysisStreamEvent) => {
            if (event.sessionId !== get().chatSessionId) {
                return;
            }
            if (event.chunk.type === 'start') {
                analysisStreamChunkCount = 0;
                set({
                    analysis: {},
                    analysisMessageId: event.chunk.messageId ?? event.messageId,
                    analysisStatus: 'streaming',
                    analysisError: null,
                });
                return;
            }

            if (event.messageId !== get().analysisMessageId) {
                return;
            }

            if (event.chunk.type === 'data-analysis') {
                const partial = event.chunk.data as DeepPartial<AiUnifiedAnalysisRes>;
                analysisStreamChunkCount += 1;
                const logger = getRendererLogger('useChatPanel');
                const partialExamples = partial.examples;
                // chunk 频率极高且带示例句全文，仅首 chunk 与每 20 个采样一次。
                if (partialExamples && (analysisStreamChunkCount === 1 || analysisStreamChunkCount % 20 === 0)) {
                    logger.debug('analysis examples chunk', {
                        chunkCount: analysisStreamChunkCount,
                        sentencesCount: partialExamples.sentences?.length ?? 0,
                        sampleSentence: partialExamples.sentences?.[0],
                    });
                }
                set({
                    analysis: mergeAnalysisPartial(get().analysis ?? {}, partial),
                    analysisStatus: 'streaming',
                });
                return;
            }
            if (event.chunk.type === 'finish') {
                set({
                    analysisStatus: 'done',
                });
                return;
            }
            if (event.chunk.type === 'error') {
                set({
                    analysisStatus: 'error',
                    analysisError: event.chunk.errorText,
                });
                return;
            }
            if (event.chunk.type === 'abort') {
                set({
                    analysisStatus: 'idle',
                    analysisMessageId: null,
                });
            }
        },
        startAnalysis: async () => {
            const text = extractTopic(get().topic);
            if (StrUtil.isBlank(text) || text === 'offscreen') {
                return;
            }
            const { messageId } = await chatApi.startAnalysis({
                sessionId: get().chatSessionId,
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
                await get().sent(`这个词/短语 "${userSelect}" 是什么意思？`);
            } else {
                await get().sent([
                    `这句话里的 "${userSelect}" 是什么意思？`,
                    '"""',
                    context,
                    '"""'
                ].join('\n'));
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
            await get().sent(`帮我把这句话改写得更地道一些：\n"""\n${text}\n"""`);
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
        },
        consumeQueuedMessage: (id: number) => {
            if (get().queuedMessage?.id === id) {
                set({ queuedMessage: null });
            }
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
    const subtitle = usePlayer.getState().sentences;
    const getSubtitle = (index: number) => {
        const direct = subtitle[index];
        if (direct?.index === index) return direct;
        return subtitle.find((sentence) => sentence.index === index);
    };
    const startSentence = getSubtitle(content.start.sIndex);
    const endSentence = getSubtitle(content.end.sIndex);
    if (!startSentence || !endSentence || content.start.sIndex > content.end.sIndex) {
        throw new Error('字幕范围无效，无法提取整句学习主题');
    }

    const startOffset = Math.max(0, Math.min(content.start.cIndex, startSentence.text.length));
    const endOffset = Math.max(0, Math.min(content.end.cIndex, endSentence.text.length));
    if (content.start.sIndex === content.end.sIndex) {
        return startSentence.text.slice(startOffset, endOffset);
    }

    const range: string[] = [startSentence.text.slice(startOffset)];
    for (let index = content.start.sIndex + 1; index < content.end.sIndex; index += 1) {
        const sentence = getSubtitle(index);
        if (!sentence) {
            throw new Error(`字幕范围缺少第 ${index} 条字幕`);
        }
        range.push(sentence.text);
    }
    range.push(endSentence.text.slice(0, endOffset));
    return range.filter((text) => text.length > 0).join(' ');
};

export default useChatPanel;
