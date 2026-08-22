import { useEffect, useMemo } from 'react';
import { useChat } from '@ai-sdk/react';
import { getToolName, isToolUIPart, type UIMessage } from 'ai';
import useChatPanel from '@/fronted/features/chat/chatStore';
import { ElectronChatTransport } from '@/fronted/features/chat/chatTransport';

/** 整句学习聊天消息的 UI 元数据。 */
export type SentenceLearningMessageMetadata = {
    /** 首条主题消息与普通追问的展示类型。 */
    kind: 'topic' | 'chat';
};

/** AI SDK useChat 使用的标准消息类型。 */
export type SentenceLearningMessage = UIMessage<SentenceLearningMessageMetadata>;

/** 供字幕查看器消费的 Agent 操作状态。 */
export type SubtitleAgentView = {
    /** 最近一次搜索的关键词。 */
    searchQuery: string | null;
    /** 最近一次搜索命中的字幕索引。 */
    searchMatches: number[];
    /** Agent 最近一次查看的上下文中间字幕索引。 */
    focusIndex: number | null;
    /** 当前是否仍在执行字幕工具。 */
    active: boolean;
    /** 最近一次字幕工具是否出错。 */
    error: boolean;
};

const emptySubtitleAgentView: SubtitleAgentView = {
    searchQuery: null,
    searchMatches: [],
    focusIndex: null,
    active: false,
    error: false,
};

/**
 * 从最近一条助手消息中提取字幕查看器状态。
 * @param messages 当前会话的 AI SDK 消息。
 * @param status 当前聊天流状态；回答完成后主动清理状态。
 * @returns 可直接传给字幕查看器的临时视图状态。
 */
const getSubtitleAgentView = (
    messages: SentenceLearningMessage[],
    status: string,
): SubtitleAgentView => {
    if (status === 'ready' || messages.length === 0) {
        return emptySubtitleAgentView;
    }

    const assistant = [...messages].reverse().find((message) => message.role === 'assistant');
    if (!assistant || messages.at(-1)?.role !== 'assistant') {
        return emptySubtitleAgentView;
    }

    let searchQuery: string | null = null;
    let searchMatches: number[] = [];
    let focusIndex: number | null = null;
    let active = false;
    let error = false;

    assistant.parts.forEach((part) => {
        if (!isToolUIPart(part)) {
            return;
        }
        const toolName = getToolName(part);
        if (toolName === 'search_subtitles') {
            const input = part.input as { queries?: string[] } | undefined;
            searchQuery = input?.queries?.join(' · ') ?? searchQuery;
            if (part.state === 'output-available') {
                const output = part.output as { matches?: Array<{ index: number }> } | undefined;
                searchMatches = output?.matches?.map((match) => match.index) ?? [];
            } else {
                active = true;
            }
        }
        if (toolName === 'get_subtitle_context') {
            if (part.state === 'output-available') {
                const output = part.output as { items?: Array<{ index: number }> } | undefined;
                const items = output?.items ?? [];
                focusIndex = items[Math.floor((items.length - 1) / 2)]?.index ?? focusIndex;
            } else {
                active = true;
            }
        }
        if (part.state === 'output-error') {
            error = true;
        }
    });

    return { searchQuery, searchMatches, focusIndex, active, error };
};

/**
 * 管理整句学习聊天会话，并把 AI SDK 工具片段转换成字幕查看器需要的状态。
 * @returns 聊天消息、输入操作、流状态和字幕 Agent 视图。
 */
export const useSentenceLearningChat = () => {
    const { chatSessionId, topicText, queuedMessage, consumeQueuedMessage, input, setInput } = useChatPanel();
    const transport = useMemo(() => new ElectronChatTransport<SentenceLearningMessage>(), []);
    const chat = useChat<SentenceLearningMessage>({
        id: chatSessionId || 'inactive-chat-session',
        transport,
        throttle: 40,
    });
    const { messages, sendMessage, status, stop } = chat;
    const isBusy = status === 'submitted' || status === 'streaming';

    useEffect(() => {
        if (!chatSessionId || !topicText || messages.length > 0 || status !== 'ready') {
            return;
        }
        sendMessage({ text: topicText, metadata: { kind: 'topic' } }, { body: { mode: 'welcome' } }).catch(() => undefined);
    }, [chatSessionId, messages.length, sendMessage, status, topicText]);

    useEffect(() => {
        if (!queuedMessage || status !== 'ready') {
            return;
        }
        const { id, content } = queuedMessage;
        consumeQueuedMessage(id);
        sendMessage({ text: content, metadata: { kind: 'chat' } }).catch(() => undefined);
    }, [consumeQueuedMessage, queuedMessage, sendMessage, status]);

    /**
     * 提交输入框内容；生成期间拒绝重复提交，并在发起请求前清空受控输入值。
     * @param message PromptInput 汇总出的文本和附件，本功能仅接收文本。
     */
    const handleSubmit = async (message: { text: string }) => {
        const trimmedInput = message.text.trim();
        if (!trimmedInput || isBusy) {
            return;
        }
        setInput('');
        await sendMessage({ text: trimmedInput, metadata: { kind: 'chat' } });
    };

    return {
        ...chat,
        messages,
        sendMessage,
        status,
        stop,
        input,
        setInput,
        handleSubmit,
        isBusy,
        subtitleAgentView: getSubtitleAgentView(messages, status),
    };
};

/** useSentenceLearningChat 对外暴露的会话控制器类型。 */
export type SentenceLearningChat = ReturnType<typeof useSentenceLearningChat>;
