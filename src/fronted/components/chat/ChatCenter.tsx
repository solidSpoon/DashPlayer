import {cn} from "@/fronted/lib/utils";
import Separator from "@/fronted/components/Separtor";
import {Textarea} from "@/fronted/components/ui/textarea";
import {Button} from "@/fronted/components/ui/button";
import * as React from "react";
import useChatPanel from "@/fronted/hooks/useChatPanel";
import CustomMessage from "@/common/types/msg/interfaces/CustomMessage";
import HumanTopicMessage from "@/common/types/msg/HumanTopicMessage";
import HumanTopicMsg from "@/fronted/components/chat/msg/HumanTopicMsg";
import AiWelcomeMsg from "@/fronted/components/chat/msg/AiWelcomeMsg";
import AiWelcomeMessage from "@/common/types/msg/AiWelcomeMessage";
import {AiNormalMsg} from "@/fronted/components/chat/msg/AiNormalMsg";
import AiNormalMessage from "@/common/types/msg/AiNormalMessage";
import HumanNormalMsg from "@/fronted/components/chat/msg/HumanNormalMsg";
import HumanNormalMessage from "@/common/types/msg/HumanNormalMessage";
import { AiCtxMenuExplainSelectWithContextMsg } from '@/fronted/components/chat/msg/AiCtxMenuExplainSelectWithContextMsg';
import AiCtxMenuExplainSelectWithContextMessage from '@/common/types/msg/AiCtxMenuExplainSelectWithContextMessage';
import { AiCtxMenuPolishMsg } from '@/fronted/components/chat/msg/AiCtxMenuPolishMsg';
import { AiCtxMenuExplainSelectMsg } from '@/fronted/components/chat/msg/AiCtxMenuExplainSelectMsg';
import AiCtxMenuExplainSelectMessage from '@/common/types/msg/AiCtxMenuExplainSelectMessage';
import { useShallow } from 'zustand/react/shallow';
import useDpTaskCenter from '@/fronted/hooks/useDpTaskCenter';
import { getRendererLogger } from '@/fronted/log/simple-logger';
import { DpTask, DpTaskState } from '@/backend/db/tables/dpTask';
import { Send } from 'lucide-react';
import AiCtxMenuPolishMessage from "@/common/types/msg/AiCtxMenuPolishMessage";

const ChatCenter = () => {
    const logger = getRendererLogger('ChatCenter');
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
                return <HumanTopicMsg msg={msg as HumanTopicMessage}/>;
            case "ai-welcome":
                return <AiWelcomeMsg msg={msg as AiWelcomeMessage}/>;
            case "ai-normal":
                return <AiNormalMsg msg={msg as AiNormalMessage}/>;
            case "human-normal":
                return <HumanNormalMsg msg={msg as HumanNormalMessage}/>;
            case 'ai-func-explain-select':
                return <AiCtxMenuExplainSelectMsg msg={msg as AiCtxMenuExplainSelectMessage}/>;
            case 'ai-func-explain-select-with-context':
                return <AiCtxMenuExplainSelectWithContextMsg msg={msg as AiCtxMenuExplainSelectWithContextMessage}/>;
            case 'ai-func-polish':
                return <AiCtxMenuPolishMsg msg={msg as AiCtxMenuPolishMessage}/>;
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

    // 发送消息的统一处理函数
    const handleSendMessage = async () => {
        const trimmedInput = input.trim();
        if (!trimmedInput || hasUnFinishedTask) return;

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
            if (hasUnFinishedTask || !input.trim()) return;
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
        <div
            ref={messagesContainerRef}
            onScroll={handleScroll}
            className={cn('w-full grow-0 flex flex-col px-2 overflow-y-auto gap-4',
                'scrollbar-none',
            )}
        >
            {
                messages.map((message, index) => {
                    if (index > 0) {
                        return (
                            <React.Fragment key={index}>
                                <Separator className={cn('pl-12 pr-4')}/>
                                {mapping(message)}
                            </React.Fragment>
                        );
                    } else {
                        return (
                            <React.Fragment key={index}>
                                {mapping(message)}
                            </React.Fragment>
                        );
                    }
                })
            }
            {streamingMessage && (
                <>
                    <Separator className={cn('pl-12 pr-4')}/>
                    {mapping(streamingMessage)}
                </>
            )}

            <div className="grid w-full mt-auto sticky bottom-0">
                <div
                    className={cn('w-full h-12 bg-gradient-to-b from-transparent to-background')}
                />
                <div className={cn('w-full bg-background pb-2')}>
                    <form
                        ref={formRef}
                        className="flex relative gap-2"
                        onSubmit={handleSubmit}
                    >
                        <Textarea
                            ref={inputRef}
                            className={cn('resize-none min-h-12 pr-12')}
                            value={input}
                            onChange={(e) => {
                                setInput(e.target.value);
                            }}
                            onKeyDown={handleKeyDown}
                            onCompositionStart={handleCompositionStart}
                            onCompositionEnd={handleCompositionEnd}
                            placeholder="Type your message here..."
                        />
                        <Button
                            className="absolute top-1/2 right-2 transform -translate-y-1/2"
                            type="submit"
                            size="icon"
                            disabled={hasUnFinishedTask || !input.trim()}
                        >
                            <Send className="size-4" />
                        </Button>
                    </form>
                </div>
            </div>
        </div>
    )
}
export default ChatCenter;
