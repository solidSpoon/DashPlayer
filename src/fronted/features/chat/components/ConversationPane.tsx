import {cn} from "@/fronted/lib/utils";
import Separator from '@/fronted/components/shared/common/Separator';
import {Textarea} from "@/fronted/components/ui/textarea";
import {Button} from "@/fronted/components/ui/button";
import * as React from "react";
import { useEffect, useMemo } from 'react';
import useChatPanel from "@/fronted/features/chat/chatStore";
import HumanTopicMessage from "@/common/types/msg/HumanTopicMessage";
import UserTopicMessage from "@/fronted/features/chat/components/messages/UserTopicMessage";
import UserTextMessage from "@/fronted/features/chat/components/messages/UserTextMessage";
import HumanNormalMessage from "@/common/types/msg/HumanNormalMessage";
import { useShallow } from 'zustand/react/shallow';
import { Send, Square } from 'lucide-react';
import AiStreamingMessage from '@/fronted/features/chat/components/messages/AiStreamingMessage';
import AiStreamingMessageModel from '@/common/types/msg/AiStreamingMessage';
import { useChat } from '@ai-sdk/react';
import { UIMessage } from 'ai';
import { ElectronChatTransport } from '@/fronted/features/chat/chatTransport';

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

const ConversationPane = () => {
    const {chatSessionId, topic, topicText, queuedMessage, consumeQueuedMessage, input, setInput} = useChatPanel(useShallow(s=> ({
        chatSessionId: s.chatSessionId,
        topic: s.topic,
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

    const inputRef = React.useRef<HTMLTextAreaElement>(null);
    const formRef = React.useRef<HTMLFormElement>(null);
    // 添加消息容器的 ref
    const messagesContainerRef = React.useRef<HTMLDivElement>(null);

    // 中文输入法状态
    const [isComposing, setIsComposing] = React.useState(false);
    // 智能滚动状态
    const [shouldAutoScroll, setShouldAutoScroll] = React.useState(true);

    // 自动滚动到底部的函数
    const scrollToBottom = React.useCallback(() => {
        if (messagesContainerRef.current && shouldAutoScroll) {
            messagesContainerRef.current.scrollTo({
                top: messagesContainerRef.current.scrollHeight,
                behavior: 'smooth'
            });
        }
    }, [shouldAutoScroll]);

    // 监听消息变化，自动滚动到底部
    React.useEffect(() => {
        // 使用 setTimeout 确保 DOM 更新完成后再滚动
        const timer = setTimeout(scrollToBottom, 0);
        return () => clearTimeout(timer);
    }, [messages, scrollToBottom]);

    // 处理滚动事件，检测用户是否在底部
    const handleScroll = React.useCallback(() => {
        if (messagesContainerRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
            const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
            setShouldAutoScroll(isNearBottom);
        }
    }, []);

    /**
     * 将标准 UIMessage 映射到现有消息展示组件。
     * @param message AI SDK 管理的消息。
     * @param index 消息在当前会话中的顺序。
     * @returns 对应的 React 消息节点。
     */
    const mapping = (message: SentenceLearningMessage, index: number) => {
        const content = getMessageText(message);
        if (message.role === 'user') {
            if (message.metadata?.kind === 'topic' || index === 0) {
                return <UserTopicMessage msg={new HumanTopicMessage(topic, content)}/>;
            }
            return <UserTextMessage msg={new HumanNormalMessage(topic, content)}/>;
        }
        if (message.role === 'assistant') {
            const isStreaming = status === 'streaming' && index === messages.length - 1;
            return <AiStreamingMessage msg={new AiStreamingMessageModel(topic, message.id, content, isStreaming)}/>;
        }
        return null;
    };

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

    // 发送消息的统一处理函数
    const handleSendMessage = async () => {
        const trimmedInput = input.trim();
        if (!trimmedInput || isBusy) return;

        // 发送消息前强制设置自动滚动为 true
        setShouldAutoScroll(true);
        await sendMessage({
            text: trimmedInput,
            metadata: { kind: 'chat' },
        });
        setInput('');
        inputRef.current?.focus();
    };

    // 处理表单提交
    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        await handleSendMessage();
    };

    // 处理键盘事件
    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === "Enter" && !e.shiftKey) {
            // 如果正在进行中文输入，不处理回车键
            if (isComposing) {
                return;
            }

            e.preventDefault();
            if (isBusy || !input.trim()) return;
            handleSendMessage();
        }
    };

    // 中文输入法开始输入
    const handleCompositionStart = () => {
        setIsComposing(true);
    };

    // 中文输入法结束输入
    const handleCompositionEnd = () => {
        setIsComposing(false);
    };

    return (
        <div className="flex h-full flex-col rounded-2xl bg-muted/30">
            <div
                ref={messagesContainerRef}
                onScroll={handleScroll}
                className={cn(
                    'w-full flex-1 overflow-y-auto px-6 pb-8 pt-4',
                    'scrollbar-none'
                )}
            >
                <div className="space-y-6">
                    {messages.map((message, index) => (
                        <React.Fragment key={message.id}>
                            {index > 0 && <Separator className={cn('opacity-10')} />}
                            {mapping(message, index)}
                        </React.Fragment>
                    ))}
                </div>
            </div>
            <div className="bg-muted/10 px-4 pb-4 pt-2">
                <form
                    ref={formRef}
                    className="relative flex items-end gap-2 rounded-[26px] bg-secondary p-1.5 shadow-sm transition-colors"
                    onSubmit={handleSubmit}
                >
                    <Textarea
                        ref={inputRef}
                        className={cn(
                            'min-h-[44px] w-full resize-none border-0 bg-transparent px-4 py-3 shadow-none focus-visible:ring-0 focus-visible:ring-offset-0',
                            'placeholder:text-muted-foreground/60'
                        )}
                        value={input}
                        onChange={(e) => {
                            setInput(e.target.value);
                        }}
                        onKeyDown={handleKeyDown}
                        onCompositionStart={handleCompositionStart}
                        onCompositionEnd={handleCompositionEnd}
                        placeholder="Ask anything..."
                    />
                    <Button
                        className="mb-1 mr-1 h-8 w-8 rounded-full shadow-none"
                        type={isBusy ? 'button' : 'submit'}
                        size="icon"
                        variant={input.trim() ? "default" : "ghost"}
                        disabled={!isBusy && !input.trim()}
                        onClick={isBusy ? () => stop() : undefined}
                    >
                        {isBusy ? <Square className="size-3.5 fill-current" /> : <Send className="size-4" />}
                    </Button>
                </form>
            </div>
        </div>
    )
}
export default ConversationPane;
