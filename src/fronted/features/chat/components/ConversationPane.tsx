import useChatPanel from '@/fronted/features/chat/chatStore';
import UserTopicMessage from '@/fronted/features/chat/components/messages/UserTopicMessage';
import { getToolName, isToolUIPart } from 'ai';
import { AlertCircle, LoaderCircle } from 'lucide-react';
import type { SentenceLearningChat, SentenceLearningMessage } from '@/fronted/features/chat/useSentenceLearningChat';
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
 * 获取工具的用户可读标题，避免把内部 snake_case 名称直接暴露给用户。
 * @param toolName AI SDK 工具名称。
 * @returns 工具展示标题。
 */
const getToolTitle = (toolName: string): string => {
    switch (toolName) {
        case 'search_subtitles':
            return '搜索字幕';
        case 'get_subtitle_context':
            return '读取字幕上下文';
        default:
            return toolName;
    }
};

/**
 * 渲染 AI SDK 消息片段，工具调用与文本保持原始流顺序。
 * @param message 当前消息。
 * @returns 消息片段节点。
 */
const renderMessageParts = (message: SentenceLearningMessage) => {
    const activeToolIndexes = message.parts.reduce<number[]>((indexes, part, index) => {
        if (isToolUIPart(part) && part.state !== 'output-available') {
            indexes.push(index);
        }
        return indexes;
    }, []);
    const firstActiveToolIndex = activeToolIndexes[0];

    return message.parts.map((part, partIndex) => {
        if (part.type === 'text') {
            return <Markdown key={`text-${partIndex}`}>{part.text}</Markdown>;
        }
        if (!isToolUIPart(part)) {
            return null;
        }
        if (partIndex !== firstActiveToolIndex) {
            return null;
        }

        const toolName = getToolName(part);
        const hasError = activeToolIndexes.some(index => {
            const activePart = message.parts[index];
            return isToolUIPart(activePart) && activePart.state === 'output-error';
        });
        return (
            <div
                key={`tool-status-${part.toolCallId}`}
                className="flex items-center gap-2 text-xs text-muted-foreground"
                role="status"
            >
                {hasError ? (
                    <AlertCircle className="size-3.5 text-destructive" />
                ) : (
                    <LoaderCircle className="size-3.5 animate-spin" />
                )}
                <span>{hasError ? '字幕上下文读取失败' : `正在${getToolTitle(toolName)}…`}</span>
            </div>
        );
    });
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
                className="mx-auto w-full max-w-4xl"
                key={message.id}
                onContextMenu={() => useChatPanel.getState().updateInternalContext(content)}
            >
                <UserTopicMessage content={content} />
            </section>
        );
    }

    return (
        <Message
            className="mx-auto w-full max-w-3xl"
            from={message.role}
            key={message.id}
        >
            <MessageContent
                className="group-[.is-assistant]:w-full group-[.is-assistant]:max-w-3xl group-[.is-assistant]:px-1 group-[.is-assistant]:py-1 group-[.is-user]:rounded-3xl group-[.is-user]:px-5 group-[.is-user]:py-3"
                onContextMenu={() => useChatPanel.getState().updateInternalContext(content)}
            >
                {isStreaming && !content && message.parts.length === 0 ? (
                    <div className="flex items-center gap-2 text-muted-foreground">
                        <Spinner />
                        <span>正在思考...</span>
                    </div>
                ) : (
                    renderMessageParts(message)
                )}
            </MessageContent>
        </Message>
    );
};

/**
 * 渲染整句学习会话，负责连接 AI SDK 会话状态与 AI Elements 的消息、滚动和输入组件。
 * @returns 完整的聊天列。
 */
const ConversationPane = ({ chat }: { chat: SentenceLearningChat }) => {
    const { messages, status, stop, input, setInput, handleSubmit, isBusy } = chat;

    return (
        <div className="flex h-full min-h-0 flex-col bg-background">
            <Conversation>
                <ConversationContent
                    className="gap-8 px-4 pb-10 pt-6 sm:px-6"
                    scrollClassName="conversation-scrollbar"
                >
                    {messages.map((message, index) => renderMessage(
                        message,
                        index,
                        status === 'streaming' && index === messages.length - 1,
                    ))}
                    {status === 'submitted' && (
                        <Message className="mx-auto w-full max-w-3xl" from="assistant">
                            <MessageContent className="flex-row items-center px-1 py-1 text-muted-foreground">
                                <Spinner />
                                <span>正在思考...</span>
                            </MessageContent>
                        </Message>
                    )}
                </ConversationContent>
                <ConversationScrollButton />
            </Conversation>
            <div className="bg-background px-4 pb-5 pt-2 sm:px-6">
                <PromptInput
                    className="mx-auto max-w-3xl [&_[data-slot=input-group]]:rounded-3xl [&_[data-slot=input-group]]:shadow-sm"
                    onSubmit={handleSubmit}
                >
                    <PromptInputBody>
                        <PromptInputTextarea
                            className="min-h-14 max-h-40 px-5 py-3.5 text-base"
                            value={input}
                            onChange={(event) => setInput(event.currentTarget.value)}
                            placeholder="输入你的问题..."
                        />
                    </PromptInputBody>
                    <PromptInputFooter className="justify-end px-3 pb-2 pt-0">
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
