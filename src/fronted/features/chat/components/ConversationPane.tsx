import { useEffect, useMemo } from 'react';
import useChatPanel from '@/fronted/features/chat/chatStore';
import UserTopicMessage from '@/fronted/features/chat/components/messages/UserTopicMessage';
import { useShallow } from 'zustand/react/shallow';
import { useChat } from '@ai-sdk/react';
import type { UIMessage } from 'ai';
import { ElectronChatTransport } from '@/fronted/features/chat/chatTransport';
import {
    Conversation,
    ConversationContent,
    ConversationScrollButton,
} from '@/fronted/components/ai-elements/conversation';
import {
    Message,
    MessageContent,
} from '@/fronted/components/ai-elements/message';
import {
    PromptInput,
    PromptInputBody,
    PromptInputFooter,
    PromptInputSubmit,
    PromptInputTextarea,
} from '@/fronted/components/ai-elements/prompt-input';
import { Spinner } from '@/fronted/components/ui/spinner';
import Markdown from '@/fronted/components/shared/markdown/Markdown';

/**
 * 整句学习聊天消息的 UI 元数据。
 */
type SentenceLearningMessageMetadata = {
    /** 首条主题消息与普通追问的展示类型。 */
    kind: 'topic' | 'chat';
};

/**
 * AI SDK useChat 使用的标准消息类型。
 */
type SentenceLearningMessage = UIMessage<SentenceLearningMessageMetadata>;

/**
 * 提取标准 UI 消息里的所有文本片段。
 * @param message AI SDK UI 消息。
 * @returns 合并后的纯文本内容。
 */
const getMessageText = (message: SentenceLearningMessage): string => {
    return message.parts
        .filter((part) => part.type === 'text')
        .map((part) => part.text)
        .join('');
};

/**
 * 渲染一条整句学习消息；消息外壳使用 AI Elements，正文保留项目的 TTS 与主题切换协议解析。
 * @param message AI SDK 管理的消息。
 * @param index 消息在当前会话中的顺序。
 * @param isStreaming 当前消息是否正在流式生成。
 * @returns 可直接放入 ConversationContent 的消息节点。
 */
const renderMessage = (
    message: SentenceLearningMessage,
    index: number,
    isStreaming: boolean,
) => {
    const content = getMessageText(message);
    const isTopic = message.role === 'user' && (message.metadata?.kind === 'topic' || index === 0);

    if (isTopic) {
        return (
            <section
                aria-label="当前学习主题"
                className="w-full"
                key={message.id}
                onContextMenu={() => useChatPanel.getState().updateInternalContext(content)}
            >
                <UserTopicMessage content={content} />
            </section>
        );
    }

    return (
        <Message from={message.role} key={message.id}>
            <MessageContent onContextMenu={() => useChatPanel.getState().updateInternalContext(content)}>
                {isStreaming && !content ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Spinner />
                        <span>正在思考...</span>
                    </div>
                ) : (
                    <Markdown>{content}</Markdown>
                )}
            </MessageContent>
        </Message>
    );
};

/**
 * 渲染整句学习会话，负责连接 AI SDK 会话状态与 AI Elements 的消息、滚动和输入组件。
 * @returns 完整的聊天列。
 */
const ConversationPane = () => {
    const {chatSessionId, topicText, queuedMessage, consumeQueuedMessage, input, setInput} = useChatPanel(useShallow(s => ({
        chatSessionId: s.chatSessionId,
        topicText: s.topicText,
        queuedMessage: s.queuedMessage,
        consumeQueuedMessage: s.consumeQueuedMessage,
        input: s.input,
        setInput: s.setInput,
    })));
    const transport = useMemo(() => new ElectronChatTransport<SentenceLearningMessage>(), []);
    const {
        messages,
        sendMessage,
        status,
        stop,
    } = useChat<SentenceLearningMessage>({
        id: chatSessionId || 'inactive-chat-session',
        transport,
        throttle: 40,
    });

    const isBusy = status === 'submitted' || status === 'streaming';

    useEffect(() => {
        if (!chatSessionId || !topicText || messages.length > 0 || status !== 'ready') {
            return;
        }
        sendMessage({
            text: topicText,
            metadata: { kind: 'topic' },
        }, {
            body: { mode: 'welcome' },
        }).catch(() => undefined);
    }, [chatSessionId, messages.length, sendMessage, status, topicText]);

    useEffect(() => {
        if (!queuedMessage || status !== 'ready') {
            return;
        }
        const { id, content } = queuedMessage;
        consumeQueuedMessage(id);
        sendMessage({
            text: content,
            metadata: { kind: 'chat' },
        }).catch(() => undefined);
    }, [consumeQueuedMessage, queuedMessage, sendMessage, status]);

    /**
     * 提交输入框内容；生成期间拒绝重复提交，并在发起请求前清空已捕获的受控输入值。
     * @param message PromptInput 汇总出的文本和附件，本功能仅接收文本。
     */
    const handleSubmit = async (message: { text: string }) => {
        const trimmedInput = message.text.trim();
        if (!trimmedInput || isBusy) {
            return;
        }
        setInput('');
        await sendMessage({
            text: trimmedInput,
            metadata: { kind: 'chat' },
        });
    };

    return (
        <div className="flex h-full min-h-0 flex-col bg-muted/30">
            <Conversation>
                <ConversationContent
                    className="px-6 pb-8 pt-4"
                    scrollClassName="conversation-scrollbar"
                >
                    {messages.map((message, index) => renderMessage(
                        message,
                        index,
                        status === 'streaming' && index === messages.length - 1,
                    ))}
                    {status === 'submitted' && (
                        <Message from="assistant">
                            <MessageContent className="flex-row items-center text-muted-foreground">
                                <Spinner />
                                <span>正在思考...</span>
                            </MessageContent>
                        </Message>
                    )}
                </ConversationContent>
                <ConversationScrollButton />
            </Conversation>
            <div className="px-4 pb-3 pt-2">
                <PromptInput className="mx-auto max-w-3xl" onSubmit={handleSubmit}>
                    <PromptInputBody>
                        <PromptInputTextarea
                            className="min-h-12 max-h-36 py-3"
                            value={input}
                            onChange={(event) => setInput(event.currentTarget.value)}
                            placeholder="输入你的问题..."
                        />
                    </PromptInputBody>
                    <PromptInputFooter className="justify-end pt-0">
                        <PromptInputSubmit
                            disabled={!isBusy && !input.trim()}
                            onStop={stop}
                            size="icon-sm"
                            status={status}
                        />
                    </PromptInputFooter>
                </PromptInput>
            </div>
        </div>
    );
};
export default ConversationPane;
