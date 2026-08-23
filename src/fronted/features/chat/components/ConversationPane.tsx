import useChatPanel from '@/fronted/features/chat/chatStore';
import useSWR, { useSWRConfig } from 'swr';
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
import type { EngineSelectionSettingVO } from '@/common/types/vo/engine-selection-setting-vo';
import type { ServiceCredentialSettingDetailVO } from '@/common/types/vo/service-credentials-setting-vo';
import { useTranslation } from 'react-i18next';
import i18n from '@/fronted/i18n';
import { settingsApi } from '@/fronted/features/settings/settingsApi';
import { useToast } from '@/fronted/components/ui/use-toast';
import Markdown from '@/fronted/components/shared/markdown/Markdown';
import { getRendererLogger } from '@/fronted/log/simple-logger';

const logger = getRendererLogger('SentenceLearningConversation');

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
 * 判断片段是否包含真正的用户可见正文，用于切分多轮工具调用。
 * @param part 当前消息片段。
 * @returns 只有非空文本片段才会结束工具组。
 */
const isNonEmptyTextPart = (part: SentenceLearningMessage['parts'][number]): boolean =>
    part.type === 'text' && part.text.trim().length > 0;

// 按消息片段保存播放进度，避免工具步骤插入后正文组件重新挂载并从头播放。
const queuedMarkdownProgress = new Map<string, number>();

/**
 * 将持续增长的流式文本排队后逐字符释放，避免网络 chunk 集中到达时正文瞬间跳变。
 * @param children 当前已收到的完整 Markdown 文本。
 * @param animate 是否启用逐字播放；历史消息直接完整展示。
 * @returns 按播放进度渲染的 Markdown 内容。
 */
const QueuedMarkdown = ({
    children,
    animate,
    queueKey,
}: {
    children: string;
    animate: boolean;
    queueKey: string;
}) => {
    const characters = useMemo(() => Array.from(children), [children]);
    const initialLength = animate
        ? Math.min(queuedMarkdownProgress.get(queueKey) ?? 0, characters.length)
        : characters.length;
    const [visibleText, setVisibleText] = useState(() => characters.slice(0, initialLength).join(''));
    const visibleLengthRef = useRef(initialLength);

    useEffect(() => {
        if (!animate) {
            visibleLengthRef.current = characters.length;
            queuedMarkdownProgress.set(queueKey, characters.length);
            setVisibleText(children);
            return;
        }
        if (visibleLengthRef.current > characters.length) {
            visibleLengthRef.current = characters.length;
            queuedMarkdownProgress.set(queueKey, characters.length);
            setVisibleText(children);
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
                queuedMarkdownProgress.set(queueKey, nextLength);
                return characters.slice(0, nextLength).join('');
            });
        }, 10);
        return () => window.clearInterval(timer);
    }, [animate, characters, children, queueKey]);

    return <Markdown>{visibleText}</Markdown>;
};

/**
 * 判断消息是否属于没有正文的工具活动，用于把同一轮连续工具调用合并展示。
 * @param message 待判断的助手消息。
 * @returns 消息仅包含工具活动与可选推理时返回 true。
 */
const isToolActivityMessage = (message: SentenceLearningMessage): boolean =>
    message.role === 'assistant'
    && getMessageText(message).trim().length === 0
    && message.parts.some((part) => isToolUIPart(part));

/**
 * 汇总连续工具活动消息，忽略思考和步骤标记，仅在出现用户可见正文时结束分组。
 * @param messages 当前会话的全部消息。
 * @param startIndex 当前工具活动消息的起始位置。
 * @returns 已合并的工具活动片段及分组结束位置。
 */
const collectToolActivityParts = (
    messages: SentenceLearningMessage[],
    startIndex: number,
): { parts: SentenceLearningMessage['parts']; endIndex: number } => {
    const parts = [] as SentenceLearningMessage['parts'];
    let endIndex = startIndex;
    for (let cursor = startIndex; cursor < messages.length; cursor += 1) {
        if (!isToolActivityMessage(messages[cursor])) {
            break;
        }
        parts.push(...messages[cursor].parts.filter((part) => (
            isToolUIPart(part) || part.type === 'reasoning'
        )));
        endIndex = cursor;
    }
    return { parts, endIndex };
};

/**
 * 获取工具的用户可读标题，避免把内部 snake_case 名称直接暴露给用户。
 * @param toolName AI SDK 工具名称。
 * @returns 工具展示标题。
 */
const getToolTitle = (toolName: string): string => {
    switch (toolName) {
        case 'search_subtitles':
            return i18n.t('common:searchSubtitles');
        case 'get_subtitle_context':
            return i18n.t('common:readSubtitleContext');
        default:
            return toolName;
    }
};

/** 将推理内容压缩成折叠状态下的一行摘要，避免只显示没有信息量的状态词。 */
const getReasoningPreview = (content: string): string => {
    const normalized = content.replace(/\s+/g, ' ').trim();
    if (normalized.length <= 72) {
        return normalized;
    }
    return `${normalized.slice(0, 72)}...`;
};

/**
 * 渲染 AI SDK 消息片段；无正文工具活动中的所有工具调用合并为一个可展开面板。
 * @param message 当前消息。
 * @returns 消息片段节点。
 */
const renderMessageParts = (
    message: SentenceLearningMessage,
    showText = true,
    animateText = false,
) => {
    const lastStreamingReasoningIndex = message.parts.findLastIndex(
        (part) => part.type === 'reasoning' && part.state === 'streaming',
    );
    const renderedParts: ReactNode[] = [];
    const shouldMergeAllToolParts = getMessageText(message).trim().length === 0
        && message.parts.some((part) => isToolUIPart(part));
    message.parts.forEach((part, partIndex) => {
        if (part.type === 'text') {
            // 后续推理只阻塞它之后的正文，前面已经完成的正文不能被整条消息级开关隐藏。
            const isAfterStreamingReasoning = lastStreamingReasoningIndex >= 0
                && partIndex > lastStreamingReasoningIndex;
            if (showText || !isAfterStreamingReasoning) {
                renderedParts.push(
                    <QueuedMarkdown
                        key={`text-${partIndex}`}
                        queueKey={`${message.id}:text-${partIndex}`}
                        animate={animateText}
                    >
                        {part.text}
                    </QueuedMarkdown>,
                );
            }
            return;
        }
        if (part.type === 'reasoning') {
            const reasoningStreaming = part.state === 'streaming';
            const reasoningPreview = getReasoningPreview(part.text);
            renderedParts.push(
                <Reasoning
                    key={`reasoning-${partIndex}`}
                    isStreaming={reasoningStreaming}
                    defaultOpen={false}
                >
                    <ReasoningTrigger
                        getThinkingMessage={(streaming, duration) => {
                            if (streaming) {
                                return reasoningPreview
                                    ? i18n.t('common:reasoningStreamingWithPreview', { preview: reasoningPreview })
                                    : i18n.t('common:reasoningStreaming');
                            }
                            return duration === undefined
                                ? i18n.t('common:reasoningProcess')
                                : i18n.t('common:reasoningDuration', { seconds: duration });
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
        // 推理片段属于同一轮活动，不应切断工具组；只有正文片段才是工具组边界。
        const toolStart = shouldMergeAllToolParts
            ? message.parts.findIndex((candidatePart) => isToolUIPart(candidatePart))
            : message.parts.slice(0, partIndex).findLastIndex(isNonEmptyTextPart) + 1;
        const nextTextOffset = message.parts.slice(partIndex).findIndex(isNonEmptyTextPart);
        const toolEnd = shouldMergeAllToolParts
            ? message.parts.length
            : nextTextOffset < 0 ? message.parts.length : partIndex + nextTextOffset;
        const toolParts = (shouldMergeAllToolParts ? message.parts : message.parts.slice(toolStart, toolEnd))
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
        const toolCountLabel = `${toolTitles.join(' · ')}${toolParts.length > 1 ? ` · ${i18n.t('common:toolCount', { count: toolParts.length })}` : ''}`;
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
    const canRevealText = !hasStreamingReasoning || !hasText;

    const hasReasoning = reasoningParts.some((part) => part.text.trim().length > 0);
    const hasTool = message.parts.some(isToolUIPart);

    return (
        <>
            {renderMessageParts(message, canRevealText, isStreaming)}
            {isStreaming && !hasText && !hasReasoning && !hasTool && (
                <div className="flex items-center gap-2 text-muted-foreground">
                    <Spinner />
                    <span>{i18n.t('common:thinking')}</span>
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
    const { t } = useTranslation('common');
    const { toast } = useToast();
    const { mutate } = useSWRConfig();
    const { data: engineSettings, mutate: mutateEngineSettings } = useSWR<EngineSelectionSettingVO>(
        'settings/engine-selection/detail',
        settingsApi.getEngineSelection,
    );
    const { data: credentialSettings } = useSWR<ServiceCredentialSettingDetailVO>(
        'settings/service-credentials/detail',
        settingsApi.getServiceCredentials,
    );
    const [savingModel, setSavingModel] = useState(false);
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

    /**
     * 保存整句学习模型选择，并刷新服务配置中的模型占用标记。
     * @param model 服务配置中已启用的模型标识。
     */
    const selectModel = async (model: string) => {
        if (!engineSettings || !credentialSettings) {
            throw new Error('模型配置尚未加载完成');
        }
        if (!engineSettings.openai.enableSentenceLearning) {
            throw new Error('整句学习功能未启用，请先在功能设置中启用');
        }
        if (!credentialSettings.openai.models.some((item) => item.model === model)) {
            throw new Error(`模型未在服务配置中启用: ${model}`);
        }

        const nextSettings: EngineSelectionSettingVO = {
            ...engineSettings,
            openai: {
                ...engineSettings.openai,
                featureModels: {
                    ...engineSettings.openai.featureModels,
                    sentenceLearning: model,
                },
            },
        };
        setSavingModel(true);
        try {
            await settingsApi.saveEngineSelection(nextSettings);
            await mutateEngineSettings(nextSettings, { revalidate: false });
            await mutate('settings/service-credentials/detail');
        } catch (error) {
            toast({
                variant: 'destructive',
                title: '模型切换失败',
                description: error instanceof Error ? error.message : String(error),
            });
        } finally {
            setSavingModel(false);
        }
    };

    const sentenceLearningEnabled = engineSettings?.openai.enableSentenceLearning === true;
    const availableModels = credentialSettings?.openai.models ?? [];

    return (
        <div className="flex h-full min-h-0 flex-col bg-background">
            <Conversation>
                <ConversationContent
                    className="gap-8 px-4 pb-10 pt-6 sm:px-6"
                    scrollClassName="conversation-scrollbar"
                >
                    {messages.map((message, index) => {
                        if (!isToolActivityMessage(message)) {
                            return renderMessage(
                                message,
                                index,
                                status === 'streaming' && index === messages.length - 1,
                            );
                        }
                        if (index > 0 && isToolActivityMessage(messages[index - 1])) {
                            return null;
                        }
                        const { parts: toolParts, endIndex } = collectToolActivityParts(messages, index);
                        logger.debug('tool activity messages merged for display', {
                            startIndex: index,
                            endIndex,
                            toolCount: toolParts.filter(isToolUIPart).length,
                            reasoningCount: toolParts.filter((part) => part.type === 'reasoning').length,
                        });
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
                    <span>{t('thinking')}</span>
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
                            placeholder={t('questionPlaceholder')}
                        />
                    </PromptInputBody>
                    <PromptInputFooter className="items-center justify-between px-3 pb-2 pt-0">
                        <div className="flex min-w-0 items-center gap-1">
                            <Select
                                disabled={!sentenceLearningEnabled || savingModel || availableModels.length === 0}
                                value={engineSettings?.openai.featureModels.sentenceLearning}
                                onValueChange={(value) => selectModel(value).catch((error) => {
                                    toast({
                                        variant: 'destructive',
                                        title: '模型切换失败',
                                        description: error instanceof Error ? error.message : String(error),
                                    });
                                })}
                            >
                                <SelectTrigger
                                    aria-label="整句学习模型"
                                    className="h-7 max-w-48 gap-1 border-0 bg-transparent px-2 text-xs text-muted-foreground shadow-none focus:ring-0"
                                >
                                    <SelectValue placeholder={sentenceLearningEnabled ? t('selectModel') : t('learningDisabled')} />
                                </SelectTrigger>
                                <SelectContent align="start">
                                    {availableModels.map((item) => (
                                        <SelectItem key={item.model} value={item.model}>{item.model}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
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
                                    <SelectItem value="auto">{t('reasoningAuto')}</SelectItem>
                                    <SelectItem value="low">{t('reasoningLow')}</SelectItem>
                                    <SelectItem value="medium">{t('reasoningMedium')}</SelectItem>
                                    <SelectItem value="high">{t('reasoningHigh')}</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
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
