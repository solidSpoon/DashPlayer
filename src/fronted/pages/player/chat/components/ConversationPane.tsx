import {cn} from "@/fronted/lib/utils";
import Separator from '@/fronted/components/shared/common/Separator';
import {Textarea} from "@/fronted/components/ui/textarea";
import {Button} from "@/fronted/components/ui/button";
import * as React from "react";
import useChatPanel from "@/fronted/hooks/useChatPanel";
import CustomMessage from "@/common/types/msg/interfaces/CustomMessage";
import HumanTopicMessage from "@/common/types/msg/HumanTopicMessage";
import UserTopicMessage from "@/fronted/pages/player/chat/components/messages/UserTopicMessage";
import AiWelcomeBubble from "@/fronted/pages/player/chat/components/messages/AiWelcomeBubble";
import AiWelcomeMessage from "@/common/types/msg/AiWelcomeMessage";
import {AiTextMessage} from "@/fronted/pages/player/chat/components/messages/AiTextMessage";
import AiNormalMessage from "@/common/types/msg/AiNormalMessage";
import UserTextMessage from "@/fronted/pages/player/chat/components/messages/UserTextMessage";
import HumanNormalMessage from "@/common/types/msg/HumanNormalMessage";
import { AiExplainSelectionWithContextMessage } from '@/fronted/pages/player/chat/components/messages/AiExplainSelectionWithContextMessage';
import AiCtxMenuExplainSelectWithContextMessage from '@/common/types/msg/AiCtxMenuExplainSelectWithContextMessage';
import { AiPolishMessage } from '@/fronted/pages/player/chat/components/messages/AiPolishMessage';
import { AiExplainSelectionMessage } from '@/fronted/pages/player/chat/components/messages/AiExplainSelectionMessage';
import AiCtxMenuExplainSelectMessage from '@/common/types/msg/AiCtxMenuExplainSelectMessage';
import { useShallow } from 'zustand/react/shallow';
import useDpTaskCenter from '@/fronted/hooks/useDpTaskCenter';
import { getRendererLogger } from '@/fronted/log/simple-logger';
import { DpTask, DpTaskState } from '@/backend/infrastructure/db/tables/dpTask';
import { Send } from 'lucide-react';
import AiCtxMenuPolishMessage from "@/common/types/msg/AiCtxMenuPolishMessage";
import AiStreamingMessage from '@/fronted/pages/player/chat/components/messages/AiStreamingMessage';
import AiStreamingMessageModel from '@/common/types/msg/AiStreamingMessage';

const ConversationPane = () => {
    const logger = getRendererLogger('ConversationPane');
    const {messages, streamingMessage, sent, input, setInput} = useChatPanel(useShallow(s=> ({
        messages: s.messages,
        streamingMessage: s.streamingMessage,
        sent: s.sent,
        input: s.input,
        setInput: s.setInput,
    })));

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
    }, [messages, streamingMessage, scrollToBottom]);

    // 处理滚动事件，检测用户是否在底部
    const handleScroll = React.useCallback(() => {
        if (messagesContainerRef.current) {
            const { scrollTop, scrollHeight, clientHeight } = messagesContainerRef.current;
            const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
            setShouldAutoScroll(isNearBottom);
        }
    }, []);

    const mapping = (msg: CustomMessage<any>) => {
        switch (msg.msgType) {
            case "human-topic":
                return <UserTopicMessage msg={msg as HumanTopicMessage}/>;
            case "ai-welcome":
                return <AiWelcomeBubble msg={msg as AiWelcomeMessage}/>;
            case "ai-normal":
                return <AiTextMessage msg={msg as AiNormalMessage}/>;
            case "human-normal":
                return <UserTextMessage msg={msg as HumanNormalMessage}/>;
            case 'ai-func-explain-select':
                return <AiExplainSelectionMessage msg={msg as AiCtxMenuExplainSelectMessage}/>;
            case 'ai-func-explain-select-with-context':
                return <AiExplainSelectionWithContextMessage msg={msg as AiCtxMenuExplainSelectWithContextMessage}/>;
            case 'ai-func-polish':
                return <AiPolishMessage msg={msg as AiCtxMenuPolishMessage}/>;
            case 'ai-streaming':
                return <AiStreamingMessage msg={msg as AiStreamingMessageModel}/>;
            default:
                return <></>
        }
    }

    const taskIds = messages.flatMap((msg) => msg.getTaskIds());
    const hasUnFinishedTask: boolean = useDpTaskCenter((s) => {
        if (!taskIds || taskIds.length === 0) {
            return false;
        }
        const ts: DpTask[] = taskIds.map(taskId => s.tasks.get(taskId))
            .filter((task): task is DpTask => !!task && task !== 'init');
        logger.debug('checking unfinished tasks', { tasks: ts });
        return ts.some(task => task.status !== DpTaskState.DONE);
    }) ?? false;

    logger.debug('unfinished task status', { hasUnFinishedTask });

    const isBusy = hasUnFinishedTask || !!streamingMessage;

    // 发送消息的统一处理函数
    const handleSendMessage = async () => {
        const trimmedInput = input.trim();
        if (!trimmedInput || isBusy) return;

        // 发送消息前强制设置自动滚动为 true
        setShouldAutoScroll(true);
        await sent(trimmedInput);
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
                    'w-full flex-1 overflow-y-auto px-6 pb-8 pt-10',
                    'scrollbar-none'
                )}
            >
                <div className="space-y-6">
                    {messages.map((message, index) => (
                        <React.Fragment key={index}>
                            {index > 0 && <Separator className={cn('opacity-10')} />}
                            {mapping(message)}
                        </React.Fragment>
                    ))}
                    {streamingMessage && (
                        <>
                            <Separator className={cn('opacity-10')} />
                            {mapping(streamingMessage)}
                        </>
                    )}
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
                        type="submit"
                        size="icon"
                        variant={input.trim() ? "default" : "ghost"}
                        disabled={isBusy || !input.trim()}
                    >
                        <Send className="size-4" />
                    </Button>
                </form>
            </div>
        </div>
    )
}
export default ConversationPane;
