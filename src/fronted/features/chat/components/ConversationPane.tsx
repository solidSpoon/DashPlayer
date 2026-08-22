import useChatPanel from '@/fronted/features/chat/chatStore';
import UserTopicMessage from '@/fronted/features/chat/components/messages/UserTopicMessage';
import { getToolName, isToolUIPart } from 'ai';
import type { ReactNode } from 'react';
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
import {
    Tool,
    ToolContent,
    ToolHeader,
    ToolInput,
    ToolOutput,
} from '@/fronted/components/ai-elements/tool';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/fronted/components/ui/select';
import type { ChatReasoningEffort } from '@/common/types/chat';
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

/** 判断文本片段是否真的包含用户可见内容，忽略工具步骤间的空白换行。 */
const isVisibleTextPart = (part: SentenceLearningMessage['parts'][number]): boolean =>
    part.type === 'text' && part.text.trim().length > 0;

/** 判断消息是否只包含工具片段，便于把同一轮多步工具调用合并展示。 */
const isToolOnlyMessage = (message: SentenceLearningMessage): boolean =>
    message.role === 'assistant'
    && getMessageText(message).trim().length === 0
    && message.parts.some((part) => isToolUIPart(part));

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
    const renderedParts: ReactNode[] = [];
    message.parts.forEach((part, partIndex) => {
        if (part.type === 'text') {
            renderedParts.push(<Markdown key={`text-${partIndex}`}>{part.text}</Markdown>);
            return;
        }
        if (!isToolUIPart(part)) {
            return;
        }
        const previousTextIndex = message.parts
            .slice(0, partIndex)
            .findLastIndex(isVisibleTextPart);
        const nextTextOffset = message.parts
            .slice(partIndex)
            .findIndex((candidatePart) => isVisibleTextPart(candidatePart));
        const nextTextIndex = nextTextOffset < 0 ? message.parts.length : partIndex + nextTextOffset;
        const toolParts = message.parts
            .slice(previousTextIndex + 1, nextTextIndex)
            .filter(isToolUIPart);
        if (toolParts[0] !== part) {
            return;
        }
        const activePart = toolParts.find((toolPart) => toolPart.state !== 'output-available') ?? toolParts[0];
        const toolTitles = toolParts.reduce<string[]>((titles, toolPart) => {
            const title = getToolTitle(getToolName(toolPart));
            if (!titles.includes(title)) {
                titles.push(title);
            }
            return titles;
        }, []);
        const toolCountLabel = `${toolTitles.join(' · ')}${toolParts.length > 1 ? ` · ${toolParts.length} 次` : ''}`;
        renderedParts.push(
            <Tool
                key={`tool-group-${part.toolCallId}`}
                className="my-1 w-fit max-w-full rounded-md border-0 bg-transparent shadow-none"
                defaultOpen={false}
            >
                {activePart.type === 'dynamic-tool' ? (
                    <ToolHeader
                        type={activePart.type}
                        state={activePart.state}
                        toolName={getToolName(activePart)}
                        className="h-7 justify-start gap-1.5 rounded-md px-1.5 py-0.5 text-xs font-normal hover:bg-muted/50"
                        title={toolCountLabel}
                    />
                ) : (
                    <ToolHeader
                        type={activePart.type}
                        state={activePart.state}
                        className="h-7 justify-start gap-1.5 rounded-md px-1.5 py-0.5 text-xs font-normal hover:bg-muted/50"
                        title={toolCountLabel}
                    />
                )}
                <ToolContent>
                    {toolParts.map((toolPart) => (
                        <div key={toolPart.toolCallId} className="space-y-2 border-b pb-3 last:border-b-0 last:pb-0">
                            <div className="text-xs font-medium text-muted-foreground">
                                {getToolTitle(getToolName(toolPart))}
                            </div>
                            {toolPart.input !== undefined && <ToolInput input={toolPart.input} />}
                            <ToolOutput
                                output={toolPart.state === 'output-available' ? toolPart.output : undefined}
                                errorText={toolPart.state === 'output-error' ? toolPart.errorText : undefined}
                            />
                        </div>
                    ))}
                </ToolContent>
            </Tool>,
        );
    });
    return renderedParts;
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
    const {
        messages,
        status,
        stop,
        input,
        setInput,
        handleSubmit,
        isBusy,
        reasoningEffort,
        setReasoningEffort,
    } = chat;

    return (
        <div className="flex h-full min-h-0 flex-col bg-background">
            <Conversation>
                <ConversationContent
                    className="gap-8 px-4 pb-10 pt-6 sm:px-6"
                    scrollClassName="conversation-scrollbar"
                >
                    {messages.map((message, index) => {
                        if (!isToolOnlyMessage(message)) {
                            return renderMessage(
                                message,
                                index,
                                status === 'streaming' && index === messages.length - 1,
                            );
                        }
                        if (index > 0 && isToolOnlyMessage(messages[index - 1])) {
                            return null;
                        }
                        const toolParts = [] as SentenceLearningMessage['parts'];
                        for (let cursor = index; cursor < messages.length; cursor += 1) {
                            if (!isToolOnlyMessage(messages[cursor])) {
                                break;
                            }
                            toolParts.push(...messages[cursor].parts.filter(isToolUIPart));
                        }
                        return renderMessage(
                            { ...message, parts: toolParts },
                            index,
                            status === 'streaming' && index === messages.length - 1,
                        );
                    })}
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
                    <PromptInputFooter className="items-center justify-between px-3 pb-2 pt-0">
                        <Select
                            value={reasoningEffort}
                            onValueChange={(value) => setReasoningEffort(value as ChatReasoningEffort)}
                        >
                            <SelectTrigger
                                aria-label="推理强度"
                                className="h-7 w-auto min-w-20 gap-1 border-0 bg-transparent px-2 text-xs text-muted-foreground shadow-none focus:ring-0"
                            >
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent align="start">
                                <SelectItem value="low">低推理</SelectItem>
                                <SelectItem value="medium">中推理</SelectItem>
                                <SelectItem value="high">高推理</SelectItem>
                            </SelectContent>
                        </Select>
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
