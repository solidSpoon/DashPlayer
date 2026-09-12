import { useEffect, useMemo, useRef } from 'react';
import { useChat } from '@ai-sdk/react';
import { getToolName, isToolUIPart, type UIMessage } from 'ai';
import useChatPanel from '@/fronted/features/chat/chatStore';
import { ElectronChatTransport } from '@/fronted/features/chat/chatTransport';
import { getRendererLogger } from '@/fronted/log/simple-logger';
import type { LearningMessageBlock, LearningMessageView } from '@/fronted/features/chat/types';
import type { GetSubtitleContextResult, SearchSubtitlesResult } from '@/common/types/chat';

/** 获取消息中的正文长度，用于记录前端首屏响应进度。 */
const getMessageTextLength = (message: UIMessage): number => message.parts
    .filter((part) => part.type === 'text')
    .reduce((length, part) => length + part.text.length, 0);

/** 获取消息中的推理长度，用于区分模型思考和正文生成阶段。 */
const getMessageReasoningLength = (message: UIMessage): number => message.parts
    .filter((part) => part.type === 'reasoning')
    .reduce((length, part) => length + part.text.length, 0);

/** 获取当前消息的有序片段摘要，用于定位推理、工具和正文之间的空档。 */
const getMessagePartSummary = (message: UIMessage): string[] => message.parts.map((part) => {
    if (part.type === 'reasoning') {
        return `reasoning:${part.state}:${part.text.length}`;
    }
    if (part.type === 'text') {
        return `text:${part.state}:${part.text.length}`;
    }
    if (isToolUIPart(part)) {
        return `tool:${getToolName(part)}:${part.state}`;
    }
    return part.type;
});

/**
 * 把 AI SDK 消息片段转换成页面可直接渲染的块序列。
 *
 * 说明：
 * - 思考片段与其它元数据被丢弃：学习者要的是结论和依据，不是模型的内部过程；
 * - 工具调用只保留「检索了什么、命中几行、读了哪段上下文、是否失败」四种信息。
 *
 * @param message 会话中的一条消息。
 * @returns 与片段顺序一致的展示块。
 */
const toMessageBlocks = (message: UIMessage): LearningMessageBlock[] => {
    const blocks: LearningMessageBlock[] = [];
    message.parts.forEach((part) => {
        if (part.type === 'text') {
            if (part.text.trim().length > 0) {
                blocks.push({ kind: 'text', text: part.text });
            }
            return;
        }
        if (!isToolUIPart(part)) {
            return;
        }
        if (part.state === 'output-error') {
            blocks.push({ kind: 'error', text: part.errorText });
            return;
        }

        const running = part.state === 'input-streaming' || part.state === 'input-available';
        const toolName = getToolName(part);
        if (toolName === 'search_subtitles') {
            const input = part.input as { queries?: string[] } | undefined;
            const output = part.output as SearchSubtitlesResult | undefined;
            const hits = output?.matches ?? [];
            blocks.push({
                kind: 'search',
                queries: input?.queries ?? [],
                hits,
                total: output?.total ?? hits.length,
                running,
            });
            return;
        }
        if (toolName === 'get_subtitle_context') {
            const output = part.output as GetSubtitleContextResult | undefined;
            blocks.push({
                kind: 'context',
                range: output?.startIndex !== undefined && output?.endIndex !== undefined
                    ? { start: output.startIndex, end: output.endIndex }
                    : null,
                running,
            });
        }
    });
    return blocks;
};

/** 把 AI SDK 消息转换成页面视图模型。 */
const toMessageView = (message: UIMessage): LearningMessageView => ({
    id: message.id,
    role: message.role === 'user' ? 'user' : 'assistant',
    blocks: toMessageBlocks(message),
});

/**
 * 管理整句学习的对话会话。
 *
 * 说明：
 * - 会话主题与周边字幕由创建会话时的后端快照冻结，对话本身只承载用户追问，
 *   打开学习页时不再额外发起一次模型调用；
 * - AI SDK 的消息协议在这里一次性收敛成视图模型，页面组件不感知工具调用细节。
 *
 * @returns 对话消息视图、输入操作与流状态。
 */
export const useSentenceLearningChat = () => {
    const { chatSessionId, queuedMessage, consumeQueuedMessage, input, setInput, conversationEpoch } = useChatPanel();
    const logger = useMemo(() => getRendererLogger('SentenceLearningChat'), []);
    const transport = useMemo(() => new ElectronChatTransport(), []);
    const chat = useChat({
        id: chatSessionId || 'inactive-chat-session',
        transport,
        throttle: 40,
    });
    const { messages, sendMessage, setMessages, status, stop } = chat;
    const isBusy = status === 'submitted' || status === 'streaming';
    // 已经清到哪一代对话：只认比它更新的那一代，避免重复清空与清掉新问题
    const appliedEpochRef = useRef(conversationEpoch);

    useEffect(() => {
        if (!chatSessionId) return;
        const latest = messages.at(-1);
        logger.debug('chat view state changed', {
            sessionId: chatSessionId,
            status,
            messageCount: messages.length,
            latestRole: latest?.role ?? null,
            latestPartCount: latest?.parts.length ?? 0,
            latestParts: latest ? getMessagePartSummary(latest) : [],
            latestTextLength: latest ? getMessageTextLength(latest) : 0,
            latestReasoningLength: latest ? getMessageReasoningLength(latest) : 0,
        });
    }, [chatSessionId, logger, messages, status]);

    useEffect(() => {
        // 同一句重新进入时不再重建会话（重建会掐断后台还在跑的解析），
        // 改由这里把屏幕上的对话清空，回到初始的空白页；会话与后台生成都留着。
        if (appliedEpochRef.current === conversationEpoch) {
            return;
        }
        // 正在流式回答时先不清：等这次回答收尾再清，避免把流到一半的消息抹掉
        if (isBusy) {
            return;
        }
        appliedEpochRef.current = conversationEpoch;
        setMessages([]);
    }, [conversationEpoch, isBusy, setMessages]);

    useEffect(() => {
        // 会话尚未建立时先留在队列里：等会话就绪再发，别丢问题也别发到空会话上
        if (!queuedMessage || !chatSessionId || status !== 'ready') {
            return;
        }
        const { id, content } = queuedMessage;
        consumeQueuedMessage(id);
        sendMessage({ text: content }).catch(() => undefined);
    }, [chatSessionId, consumeQueuedMessage, queuedMessage, sendMessage, status]);

    const messageViews = useMemo(() => messages.map(toMessageView), [messages]);

    /**
     * 提交输入框内容；生成期间拒绝重复提交，并在发起请求前清空受控输入值。
     *
     * 说明：会话尚未建立时也拒绝：对话要落到会话冻结的主题上，没有会话就没有可发的地方
     * （此时页面已把发送按钮与快捷提问置灰，这里只是兜住输入框回车这条路径）。
     *
     * @param text 用户输入的追问内容。
     */
    const handleSubmit = async (text: string) => {
        const trimmedInput = text.trim();
        if (!trimmedInput || isBusy || !chatSessionId) {
            return;
        }
        setInput('');
        await sendMessage({ text: trimmedInput });
    };

    return {
        messageViews,
        status,
        stop,
        input,
        setInput,
        handleSubmit,
        isBusy,
    };
};

/** useSentenceLearningChat 对外暴露的会话控制器类型。 */
export type SentenceLearningChat = ReturnType<typeof useSentenceLearningChat>;
