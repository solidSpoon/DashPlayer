import useChatPanel from '@/fronted/features/chat/chatStore';
import UserTopicMessage from '@/fronted/features/chat/components/messages/UserTopicMessage';
import { getToolName, isToolUIPart } from 'ai';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
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
    Reasoning,
    ReasoningContent,
    ReasoningTrigger,
} from '@/fronted/components/ai-elements/reasoning';
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

/**
 * 将持续增长的流式文本排队后逐字符释放，避免网络 chunk 集中到达时正文瞬间跳变。
 * @param children 当前已收到的完整 Markdown 文本。
 * @param animate 是否启用逐字播放；历史消息直接完整展示。
 * @returns 按播放进度渲染的 Markdown 内容。
 */
const QueuedMarkdown = ({ children, animate }: { children: string; animate: boolean }) => {
    const characters = useMemo(() => Array.from(children), [children]);
    const [visibleText, setVisibleText] = useState(animate ? '' : children);
    const visibleLengthRef = useRef(animate ? 0 : characters.length);

    useEffect(() => {
        if (!animate) {
            visibleLengthRef.current = characters.length;
            setVisibleText(children);
            return;
        }
        if (visibleLengthRef.current >= characters.length) {
            return;
        }

        const timer = window.setInterval(() => {
            setVisibleText((current) => {
                const remaining = characters.length - visibleLengthRef.current;
                if (remaining <= 0) {
                    window.clearInterval(timer);
                    return current;
                }
                // 正常状态接近自然打字速度，积压较多时分档追赶。
                const step = remaining > 300 ? 6 : remaining > 120 ? 3 : 1;
                const nextLength = Math.min(characters.length, visibleLengthRef.current + step);
                visibleLengthRef.current = nextLength;
                return characters.slice(0, nextLength).join('');
            });
        }, 10);
        return () => window.clearInterval(timer);
    }, [animate, characters, children]);

    return <Markdown>{visibleText}</Markdown>;
};

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
const renderMessageParts = (
    message: SentenceLearningMessage,
    showText = true,
    onLastReasoningCollapse?: () => void,
    animateText = false,
) => {
    const lastReasoningIndex = message.parts.findLastIndex((part) => part.type === 'reasoning');
    const renderedParts: ReactNode[] = [];
    message.parts.forEach((part, partIndex) => {
        if (part.type === 'text') {
            if (showText) {
                renderedParts.push(
                    <QueuedMarkdown key={`text-${partIndex}`} animate={animateText}>
                        {part.text}
                    </QueuedMarkdown>,
                );
            }
            return;
        }
        if (part.type === 'reasoning') {
            const reasoningStreaming = part.state === 'streaming';
            renderedParts.push(
                <Reasoning
                    key={`reasoning-${partIndex}`}
                    isStreaming={reasoningStreaming}
                    defaultOpen={reasoningStreaming}
                    onCollapseComplete={partIndex === lastReasoningIndex ? onLastReasoningCollapse : undefined}
                >
                    <ReasoningTrigger
                        getThinkingMessage={(streaming, duration) => {
                            if (streaming) return '正在思考...';
                            return duration === undefined ? '思考过程' : `思考了 ${duration} 秒`;
                        }}
                    />
                    <ReasoningContent>{part.text}</ReasoningContent>
                </Reasoning>,
            );
            return;
        }
        if (!isToolUIPart(part)) {
            return;
        }
        const toolStart = message.parts.slice(0, partIndex).findLastIndex((candidatePart) => !isToolUIPart(candidatePart)) + 1;
        const nextNonToolOffset = message.parts.slice(partIndex).findIndex((candidatePart) => !isToolUIPart(candidatePart));
        const toolEnd = nextNonToolOffset < 0 ? message.parts.length : partIndex + nextNonToolOffset;
        const toolParts = message.parts.slice(toolStart, toolEnd).filter(isToolUIPart);
        if (toolStart !== partIndex) {
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
 * 控制思考片段与正文的交接，等待思考折叠动画结束后再揭示正文。
 * @param message 当前 assistant 消息。
 * @param isStreaming 当前消息是否仍在流式生成。
 * @returns 按原始片段顺序渲染的思考、工具和正文内容。
 */
const AssistantMessageParts = ({
    message,
    isStreaming,
}: {
    message: SentenceLearningMessage;
    isStreaming: boolean;
}) => {
    const reasoningParts = message.parts.filter((part) => part.type === 'reasoning');
    const hasStreamingReasoning = reasoningParts.some((part) => part.state === 'streaming');
    const hasText = getMessageText(message).trim().length > 0;
    // 推理尚未结束时只延迟已经到达的正文；工具阶段没有正文时仍应保持工具过程可见。
    const [canRevealText, setCanRevealText] = useState(
        reasoningParts.length === 0 || !hasStreamingReasoning || !hasText,
    );

    useEffect(() => {
        if (reasoningParts.length === 0) {
            setCanRevealText(true);
            return;
        }
        if (hasStreamingReasoning && hasText) {
            setCanRevealText(false);
        }
    }, [hasStreamingReasoning, hasText, reasoningParts.length]);

    const hasReasoning = reasoningParts.some((part) => part.text.trim().length > 0);
    const hasTool = message.parts.some(isToolUIPart);

    return (
        <>
            {renderMessageParts(message, canRevealText, () => setCanRevealText(true), isStreaming)}
            {isStreaming && !hasText && !hasReasoning && !hasTool && (
                <div className="flex items-center gap-2 text-muted-foreground">
                    <Spinner />
                    <span>正在思考...</span>
                </div>
            )}
        </>
    );
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
                <AssistantMessageParts message={message} isStreaming={isStreaming} />
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
                            toolParts.push(...messages[cursor].parts.filter((part) => (
                                isToolUIPart(part) || part.type === 'reasoning'
                            )));
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
