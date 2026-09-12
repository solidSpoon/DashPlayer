/**
 * 管理播放器整句学习面板的会话与上下文操作。
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
import { settingsApi } from '@/fronted/features/settings/settingsApi';
import { Topic } from '@/common/types/chat';
import { AnalysisStreamEvent, DeepPartial } from '@/common/types/analysis';
import { AiUnifiedAnalysisRes } from '@/common/types/aiRes/AiUnifiedAnalysisRes';
import { Sentence } from '@/common/types/SentenceC';

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
    /** 学习句的中文译文，展示在句子下方；未走云端整句补全时为空。 */
    topicTranslation: string;
    /** 由上下文菜单排队、等待聊天组件发送的追问。 */
    queuedMessage: { id: number; content: string } | null;
    /** 当前学习主题的字幕位置或直接文本。 */
    topic: Topic
    /** 学习页是否显示；为 false 时只隐藏，不卸载。 */
    learningVisible: boolean;
    /** 整句补全失败信息；由 LearningPage 提示用户，新一轮补全开始时清空。 */
    sentenceResolveError: string | null;
    /** 创建会话时冻结的学习句字幕索引，用于避免重复创建会话。 */
    anchorIndex: number | null;
    /**
     * 这次会话的判重依据，用于识别「又进了同一句」。
     *
     * 说明：主题文本会被云端整句补全改写，拿它判重会认不出是同一句；
     * 因此从当前字幕行建的会话记下当时那行原文，从选区建的会话记下选区原文。
     */
    topicKey: string | null;
    /** 结构化分析结果；懒加载，null 表示尚未生成。 */
    analysis: Partial<AiUnifiedAnalysisRes> | null;
    /** 当前分析消息 ID；用于丢弃旧分析流的迟到片段。 */
    analysisMessageId: string | null;
    /** 分析生命周期：idle 未开始 / streaming 生成中 / done 完成 / error 失败。 */
    analysisStatus: 'idle' | 'streaming' | 'done' | 'error';
    /** 分析失败信息；status 为 error 时由页面提示用户。 */
    analysisError: string | null;
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
    /** 接收后端推来的分析流事件，更新解析面板状态。 */
    receiveAnalysisStream: (event: AnalysisStreamEvent) => void;
    /** 启动当前学习句的结构化分析（懒加载，点击左栏入口时触发）。 */
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
        topicTranslation: '',
        queuedMessage: null,
        topic: 'offscreen',
        learningVisible: false,
        sentenceResolveError: null,
        anchorIndex: null,
        topicKey: null,
        analysis: null,
        analysisMessageId: null,
        analysisStatus: 'idle',
        analysisError: null,
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
    learningCloseRequested = false;
    usePlayer.getState().pause();
    useChatPanel.setState({ learningVisible: true });
};

/**
 * 乐观进入学习页：先把当前字幕行摆上主舞台，不等云端补全与建会话返回。
 *
 * 说明：整句补全要等模型、建会话要等后端，页面不该等它们返回才显示；
 * 这里顺手清掉上一轮会话的解析与对话痕迹并关掉旧会话，避免新句子短暂挂在旧解析上。
 * 生词与悬停取词来自本地词典，此刻就已经可用。
 *
 * @param sentence 当前字幕句，作为新主题的占位原文。
 */
const enterLearningOptimistically = (sentence: Sentence): void => {
    const previousSessionId = useChatPanel.getState().chatSessionId;
    if (previousSessionId) {
        chatApi.closeSession(previousSessionId).catch((error) => {
            chatLogger.error('failed to close previous chat session', { error });
        });
    }
    useChatPanel.setState({
        ...empty(),
        topicText: sentence.text,
        anchorIndex: sentence.index,
    });
    enterLearning();
};

/**
 * 上一轮为同一句冻结下来的学习内容。
 *
 * 说明：完整句与译文来自云端整句补全，重新进同一句不必再花一次模型调用；
 * 但对话记录属于上一轮的问答，不复用——重新进入要回到初始的空白页。
 */
type ReusableTopic = {
    /** 创建会话时冻结的主题原文；可能已被整句补全改写，不等于字幕行原文。 */
    text: string;
    /** 主题在字幕中的定位。 */
    topic: Topic;
    /** 主题的中文译文；未走云端整句补全时为空字符串。 */
    translation: string;
};

/**
 * 取出上一轮为同一句冻结下来的学习内容。
 *
 * 说明：用户会在播放画面与学习页之间反复切换，命中的同一句不该再消耗一次云端整句补全，
 * 因此按「会话是怎么建的」比对判重依据：主题文本会被补全改写，
 * 只有记下来的那行原文/选区原文才认得出同一句。
 *
 * @param text 本次学习内容的判重依据：从当前字幕行进来的传那行原文，从选区进来的传选区原文。
 * @param anchorIndex 主题所在字幕索引。
 * @returns 命中同一句时返回可复用的主题文本、定位与译文；否则返回 null。
 */
const takeReusableTopic = (text: string, anchorIndex: number | null): ReusableTopic | null => {
    const state = useChatPanel.getState();
    if (!state.chatSessionId || state.anchorIndex !== anchorIndex || state.topicKey !== text) {
        return null;
    }
    return { text: state.topicText, topic: state.topic, translation: state.topicTranslation };
};

/**
 * 读取云端整句学习功能开关，决定是否启用整句补全。
 *
 * 说明：开关读取失败时按未启用处理并显式记录，不阻塞学习页进入；
 * 失败信息写入 sentenceResolveError，由页面提示用户。
 *
 * @returns 开关开启时为 true。
 */
const isSentenceLearningCloudEnabled = async (): Promise<boolean> => {
    try {
        const engineSelection = await settingsApi.getEngineSelection();
        return engineSelection?.openai?.enableSentenceLearning === true;
    } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        chatLogger.error('读取整句学习功能开关失败，本次跳过整句补全', { error: message });
        useChatPanel.setState({ sentenceResolveError: message });
        return false;
    }
};

// 防止快捷键重复触发时并发创建多个整句学习会话。
let sessionCreationInFlight = false;
// 分析流 chunk 计数：仅用于日志采样，展示合并不依赖它。
let analysisStreamChunkCount = 0;
// 防止快捷键重复触发时并发进入整句学习（含整句补全等待期）。
let learningEntryInFlight = false;
// 进入流程（整句补全+建会话）尚未结束时用户关闭了学习页：
// 记下意图，流程收尾时保持关闭，不把页面弹回来。
let learningCloseRequested = false;

/**
 * 新建一次整句学习会话。
 *
 * 行为说明：
 * - 每次调用都新建后端会话：会话 ID 一变，聊天记录即归零，重新进入同一句回到初始空白页；
 * - 主题文本、周边字幕与字幕锚点在后端会话中冻结，后续对话只追加用户追问；
 * - 会话就绪前页面上的对话与解析入口不可用（见 LearningWorkspace 的 sessionReady）；
 * - 结构化分析不由这里发起，由用户在学习页点入口时按需触发。
 *
 * @param text 本次学习的主题原文；复用上一轮补全结果时传冻结的完整句。
 * @param anchor 主题所在字幕句，用于定位字幕缓存与周边段落。
 * @param topic 主题在字幕中的定位；由选区创建时用于后续重新提取原文。
 * @param topicKey 本次学习内容的判重依据；下次再进同一句时凭它认出可复用的补全结果。
 * @param translation 学习句的中文译文；复用上一轮补全结果时传冻结的译文，没走补全时传空字符串。
 * @throws 缺少视频 ID 或字幕锚点时抛出，避免创建无法使用字幕工具的残废会话。
 */
const startSessionForTopic = async (
    text: string,
    anchor: Sentence,
    topic: Topic,
    topicKey: string,
    translation: string
): Promise<void> => {
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

    // 冻结内容先摆上页面：整句补全与译文此刻已经确定，等建会话返回再显示只会白等一次 IPC；
    // 顺带清掉上一轮会话的对话与解析，重新进入同一句时不会挂着上一轮的聊天记录
    useChatPanel.setState({
        ...empty(),
        topicText: text,
        topicTranslation: translation,
        topic,
        topicKey,
        learningVisible: true,
        anchorIndex: anchor.index,
    });

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

    useChatPanel.setState({ chatSessionId: sessionId });
    // 进入学习页即暂停：学习界面不播放，也不承载播放控制
    usePlayer.getState().pause();
    sessionCreationInFlight = false;
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
            // 同一段选区：完整句与译文已经拿过，直接复用，不重复花模型调用
            const reusable = takeReusableTopic(text, currentSentence.index);
            if (reusable) {
                await startSessionForTopic(reusable.text, currentSentence, reusable.topic, text, reusable.translation);
                return;
            }
            await startSessionForTopic(text, currentSentence, { content: text }, text, '');
        },
        createFromCurrent: async () => {
            const currentSentence = usePlayer.getState().currentSentence;
            if (!currentSentence) {
                return;
            }
            if (learningEntryInFlight) {
                // 进入流程还在跑（整句补全/建会话）：相当于重新打开页面等结果，不重复发起
                enterLearning();
                return;
            }
            learningEntryInFlight = true;
            // 同一句：复用上次补全出的完整句与译文（不再花模型调用），但仍新建会话，
            // 于是重新进来看到的是初始空白页而不是上一轮的聊天记录
            const reusable = takeReusableTopic(currentSentence.text, currentSentence.index);
            try {
                if (reusable) {
                    await startSessionForTopic(reusable.text, currentSentence, reusable.topic, currentSentence.text, reusable.translation);
                    return;
                }
                // 当前行先上主舞台：整句补全与会话创建都要等后端返回，等它们回来再显示页面会长时间空白
                enterLearningOptimistically(currentSentence);
                // 云端整句学习启用时，先把可能被换行截断的字幕补成完整句，再创建会话
                let topicText = currentSentence.text;
                let translation = '';
                if (await isSentenceLearningCloudEnabled()) {
                    try {
                        const sentences = usePlayer.getState().sentences;
                        const position = sentences.findIndex(
                            (sentence) => sentence.index === currentSentence.index && sentence.fileHash === currentSentence.fileHash
                        );
                        const precedingLines = position >= 0
                            ? sentences.slice(Math.max(0, position - 2), position).map((sentence) => sentence.text ?? '')
                            : [];
                        const followingLines = position >= 0
                            ? sentences.slice(position + 1, position + 6).map((sentence) => sentence.text ?? '')
                            : [];
                        const result = await chatApi.completeSentence({
                            text: topicText,
                            precedingLines,
                            followingLines,
                        });
                        // 译文与补全同批返回，先落状态：句子没被改写时也要有中文
                        translation = result.translation.trim();
                        if (translation) {
                            useChatPanel.setState({ topicTranslation: translation });
                        }
                        if (StrUtil.isNotBlank(result.sentence) && result.sentence !== topicText) {
                            topicText = result.sentence;
                            // 补全结果不等建会话就换上：生词与位置标签随新原句立即重算
                            useChatPanel.setState({ topicText });
                        }
                    } catch (error) {
                        const message = error instanceof Error ? error.message : String(error);
                        chatLogger.error('整句补全失败，使用当前字幕行创建会话', { error: message });
                        useChatPanel.setState({ sentenceResolveError: message });
                    }
                }
                // 补全改变了原文时用纯文本主题：字符范围已无法指回单行字幕
                const topic: Topic = topicText === currentSentence.text
                    ? {
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
                    }
                    : { content: topicText };
                // 判重依据是这行原文而非补全后的主题：下次再进同一句要能认出会话
                await startSessionForTopic(topicText, currentSentence, topic, currentSentence.text, translation);
            } finally {
                learningEntryInFlight = false;
                if (!useChatPanel.getState().chatSessionId) {
                    // 会话没建起来：页面上的对话与解析都无从发起，退回播放画面，错误由调用方提示
                    set(empty());
                } else if (learningCloseRequested) {
                    // 用户在进入流程进行中关闭了学习页：收尾保持关闭，不把页面弹回来
                    learningCloseRequested = false;
                    set({ learningVisible: false });
                }
            }
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
            if (learningEntryInFlight) {
                // 进入流程尚未结束：记录关闭意图，流程收尾时保持关闭
                learningCloseRequested = true;
            }
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

/**
 * 深度合并分析流分片：数组按位合并、对象递归合并，undefined 分片不覆盖已有值。
 *
 * 说明：模型按字段顺序流式输出（structure → phrases），
 * 后到的分片只含部分字段，直接浅合并会丢掉先到的字段，这里按结构逐层归并。
 *
 * @param current 已合并的分析结果。
 * @param partial 新到的分片。
 * @returns 合并后的完整分析结果。
 */
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

/**
 * 从学习主题中提取纯文本：选区主题按字幕范围截取，纯文本主题原样返回。
 *
 * @param t 当前学习主题。
 * @returns 主题纯文本；主题为 offscreen 时原样返回。
 */
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
    return range.join('\n');
};

export default useChatPanel;
