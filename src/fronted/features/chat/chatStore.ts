/**
 * 管理播放器整句学习面板的会话、分析结果和上下文操作。
 */
import { create } from 'zustand';
import { subscribeWithSelector } from 'zustand/middleware';
import { engEqual, p } from '@/common/utils/Util';
import { usePlayer } from '@/fronted/features/player/playerStore';
import useFile from '@/fronted/features/file-browser/fileStore';
import { getTtsUrl, playAudioUrl } from '@/fronted/infrastructure/audio/AudioPlayer';
import StrUtil from '@/common/utils/str-util';
import { getRendererLogger } from '@/fronted/log/simple-logger';
import { TypeGuards } from '@/common/utils/TypeGuards';
import { chatApi } from '@/fronted/features/chat/chatApi';
import { Topic } from '@/common/types/chat';
import { Sentence } from '@/common/types/SentenceC';
import { AnalysisStreamEvent, DeepPartial } from '@/common/types/analysis';
import { AiUnifiedAnalysisRes } from '@/common/types/aiRes/AiUnifiedAnalysisRes';

/** 整句学习面板中需要跨组件共享的状态。 */
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
    /** 学习页是否显示；为 false 时只隐藏，不卸载。 */
    learningVisible: boolean;
    /** 创建会话时冻结的学习句字幕索引，用于避免重复创建会话。 */
    anchorIndex: number | null;
    /** 右键菜单打开时冻结的操作上下文。 */
    context: string | null;
    /** 受控聊天输入框文本。 */
    input: string;
};

/** 整句学习面板对外暴露的状态操作。 */
export type ChatPanelActions = {
    createFromSelect: (text?: string) => Promise<void>;
    createFromCurrent: () => Promise<void>;
    /** 切换学习页：已打开则返回播放画面，未打开则进入当前句的学习页。 */
    toggleLearning: () => Promise<void>;
    /** 返回播放画面，只隐藏学习页，不销毁会话。 */
    hideLearning: () => void;
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
    setInput: (input: string) => void;
    consumeQueuedMessage: (id: number) => void;
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
        learningVisible: false,
        anchorIndex: null,
        context: null,
        input: ''
    };
};

const chatLogger = getRendererLogger('useChatPanel');

/**
 * 进入学习页：暂停当前播放并显示学习页。
 *
 * 说明：学习页不承载播放控制，进来就应该停下来，用户看完点「返回播放画面」再继续。
 */
const enterLearning = () => {
    usePlayer.getState().pause();
    useChatPanel.setState({ learningVisible: true });
};

/**
 * 判断当前存活的会话是否已经就是这条学习主题。
 *
 * 说明：用户会在播放画面与学习页之间反复切换，命中的同一句不应该重新创建会话、
 * 也就不应该重复消耗一次结构化分析调用。
 *
 * @param text 本次要学习的主题原文。
 * @param anchorIndex 主题所在字幕索引。
 * @returns 复用了现有会话时为 true。
 */
const reuseSessionIfSameTopic = (text: string, anchorIndex: number | null): boolean => {
    const state = useChatPanel.getState();
    if (!state.chatSessionId || state.anchorIndex !== anchorIndex) {
        return false;
    }
    if (state.topicText.trim() !== text.trim()) {
        return false;
    }
    enterLearning();
    return true;
};

// 流式分析 chunk 计数：仅在收到 start 时归零，用于节流 chunk 级调试日志。
let analysisStreamChunkCount = 0;
// 防止快捷键重复触发时并发创建多个整句学习会话。
let sessionCreationInFlight = false;

/**
 * 新建一次整句学习会话。
 *
 * 行为说明：
 * - 主题文本、周边字幕与字幕锚点在后端会话中冻结，后续对话只追加用户追问；
 * - 主题创建成功后立即启动结构化分析，这是打开面板唯一的一次模型调用。
 *
 * @param text 本次学习的主题原文。
 * @param anchor 主题所在字幕句，用于定位字幕缓存与周边段落。
 * @param topic 主题在字幕中的定位；由选区创建时用于后续重新提取原文。
 * @throws 缺少视频 ID 或字幕锚点时抛出，避免创建无法使用字幕工具的残废会话。
 */
const startSessionForTopic = async (text: string, anchor: Sentence, topic: Topic): Promise<void> => {
    const videoId = useFile.getState().videoId;
    if (!videoId) {
        throw new Error('当前视频 ID 不存在，无法创建整句学习会话');
    }
    if (sessionCreationInFlight) {
        chatLogger.warn('忽略重复的整句学习会话创建请求');
        return;
    }

    const sentences = usePlayer.getState().sentences;
    const anchorPosition = sentences.findIndex(
        (sentence) => sentence.index === anchor.index && sentence.fileHash === anchor.fileHash
    );
    const paragraphLines = sentences
        .slice(Math.max(0, anchorPosition - 5), Math.min(sentences.length, anchorPosition + 6))
        .filter(TypeGuards.isNotNull)
        .map((sentence) => sentence.text ?? '');

    sessionCreationInFlight = true;
    const previousSessionId = useChatPanel.getState().chatSessionId;
    if (previousSessionId) {
        chatApi.closeSession(previousSessionId).catch((error) => {
            chatLogger.error('failed to close previous chat session', { error });
        });
    }

    let sessionId: string;
    try {
        ({ sessionId } = await chatApi.createSession({
            videoId,
            originalTopic: text,
            paragraphLines,
            subtitleFileHash: anchor.fileHash,
            anchorSentenceIndex: anchor.index,
        }));
    } catch (error) {
        sessionCreationInFlight = false;
        throw error;
    }
    chatLogger.info('sentence learning session created', {
        sessionId,
        topicLength: text.length,
        paragraphLineCount: paragraphLines.length,
        anchorSentenceIndex: anchor.index,
    });

    useChatPanel.setState({
        ...empty(),
        chatSessionId: sessionId,
        topicText: text,
        topic,
        learningVisible: true,
        anchorIndex: anchor.index,
    });
    // 进入学习页即暂停：学习界面不播放，也不承载播放控制
    usePlayer.getState().pause();
    sessionCreationInFlight = false;

    // 解析改为按需触发：打开学习页只准备会话，用户点击左栏懒加载入口时才调 startAnalysis
};

const useChatPanel = create(
    subscribeWithSelector<ChatPanelState & ChatPanelActions>((set, get) => ({
        ...empty(),
        createFromSelect: async (str?: string) => {
            let text = str;
            if (StrUtil.isBlank(text)) {
                text = p(window.getSelection()?.toString());
                // 去除换行符
                text = text?.replace(/\n/g, '');
                if (StrUtil.isBlank(text)) {
                    text = get().context ?? '';
                }
                if (StrUtil.isBlank(text)) {
                    return;
                }
            }
            const currentSentence = usePlayer.getState().currentSentence;
            if (!currentSentence) {
                throw new Error('当前字幕句不存在，无法创建带上下文工具的整句学习会话');
            }
            if (reuseSessionIfSameTopic(text, currentSentence.index)) {
                return;
            }
            await startSessionForTopic(text, currentSentence, { content: text });
        },
        createFromCurrent: async () => {
            const currentSentence = usePlayer.getState().currentSentence;
            if (!currentSentence) {
                return;
            }
            if (reuseSessionIfSameTopic(currentSentence.text, currentSentence.index)) {
                return;
            }
            const topic: Topic = {
                content: {
                    start: {
                        sIndex: currentSentence.index,
                        cIndex: 0
                    },
                    end: {
                        sIndex: currentSentence.index,
                        cIndex: currentSentence.text.length
                    }
                }
            };
            await startSessionForTopic(currentSentence.text, currentSentence, topic);
        },
        toggleLearning: async () => {
            // 同一个快捷键开关学习页：已打开就返回播放画面（只隐藏，不销毁会话）
            if (get().learningVisible) {
                get().hideLearning();
                return;
            }
            await get().createFromCurrent();
        },
        hideLearning: () => {
            set({ learningVisible: false });
        },
        clear: () => {
            const sessionId = get().chatSessionId;
            if (sessionId) {
                chatApi.closeSession(sessionId).catch((error) => {
                    chatLogger.error('failed to close chat session', { error });
                });
            }
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
                chatLogger.info('analysis stream started in renderer', {
                    sessionId: event.sessionId,
                    messageId: event.chunk.messageId ?? event.messageId,
                });
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
                // chunk 频率极高，仅首 chunk 与每 20 个采样一次。
                if (analysisStreamChunkCount === 1 || analysisStreamChunkCount % 20 === 0) {
                    chatLogger.debug('analysis chunk', {
                        chunkCount: analysisStreamChunkCount,
                        keys: Object.keys(partial ?? {}),
                    });
                }
                set({
                    analysis: mergeAnalysisPartial(get().analysis ?? {}, partial),
                    analysisStatus: 'streaming',
                });
                return;
            }
            if (event.chunk.type === 'finish') {
                chatLogger.info('analysis stream finished in renderer', {
                    sessionId: event.sessionId,
                    messageId: event.messageId,
                    chunkCount: analysisStreamChunkCount,
                });
                set({
                    analysisStatus: 'done',
                });
                return;
            }
            if (event.chunk.type === 'error') {
                chatLogger.error('analysis stream failed in renderer', {
                    sessionId: event.sessionId,
                    messageId: event.messageId,
                    errorText: event.chunk.errorText,
                });
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
            chatLogger.debug('context menu opened', { context: internalContext });
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
    chatLogger.debug('extract topic', { topic: t });
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
