'use client';

import * as React from 'react';
import {cn} from "@/fronted/lib/utils";
import {motion} from 'framer-motion';
import ChatLeftWords from '@/fronted/components/chat/ChatLeftWords';
import ChatLeftPhrases from '@/fronted/components/chat/ChatLeftPhrases';
import ChatLeftGrammers from '@/fronted/components/chat/ChatLeftGrammers';
import ChatRightSentences from '@/fronted/components/chat/ChatRightSentences';
import ChatCenter from '@/fronted/components/chat/ChatCenter';
import ChatTopicSelector from '@/fronted/components/chat/ChatTopicSelector';

import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuTrigger
} from '@/fronted/components/ui/context-menu';
import useChatPanel from '@/fronted/hooks/useChatPanel';
import {Button} from '@/fronted/components/ui/button';
import {ChevronLeft, ChevronRight, X} from 'lucide-react';
import {useShallow} from 'zustand/react/shallow';
import {useHotkeys} from "react-hotkeys-hook";

const Chat = () => {
    const {createFromSelect, clear, forward, backward, canUndo, canRedo} = useChatPanel(useShallow(s => ({
        createFromSelect: s.createFromSelect,
        clear: s.clear,
        forward: s.forward,
        backward: s.backward,
        canRedo: s.canRedo,
        canUndo: s.canUndo
    })));
    const {
        ctxMenuExplain,
        ctxMenuOpened,
        ctxMenuPlayAudio,
        ctxMenuPolish,
        ctxMenuQuote,
        ctxMenuCopy,
        closeChat,
    } = useChatPanel(useShallow(s => ({
        ctxMenuExplain: s.ctxMenuExplain,
        ctxMenuOpened: s.ctxMenuOpened,
        ctxMenuPlayAudio: s.ctxMenuPlayAudio,
        ctxMenuPolish: s.ctxMenuPolish,
        ctxMenuQuote: s.ctxMenuQuote,
        ctxMenuCopy: s.ctxMenuCopy,
        closeChat: s.clear,
    })));


    useHotkeys<HTMLParagraphElement>(['slash'], (e) => {
        closeChat();
        e.stopPropagation();
    })


    return (
        <motion.div
            className={cn('fixed top-0 right-0  w-full h-full z-[999] bg-foreground/90')}
            initial={{opacity: 0}}
            animate={{
                opacity: 1,
                transition: {
                    duration: 0.3,
                    type: 'just'
                }
            }}
            exit={{opacity: 0}}
        >
            <ContextMenu
                onOpenChange={(open) => {
                    if (open) {
                        ctxMenuOpened();
                    }
                }}
                modal={true}
            >
                <ContextMenuTrigger
                >
                    <motion.div
                        className={cn(
                            'focus:outline-none flex flex-col fixed top-[44px] z-[998] right-0 w-full bg-background pb-4 select-text',
                            'border rounded-t-[10px] border-background shadow-lg'
                        )}
                        style={{
                            height: 'calc(100vh - 44px)'
                        }}
                        // 从下往上弹出
                        initial={{y: '100%'}}
                        animate={{
                            y: 0,
                            transition: {
                                duration: 0.3,
                                type: 'just'
                            }
                        }}
                        exit={{
                            y: '100%',
                            transition: {
                                duration: 0.3,
                                type: 'just'
                            }
                        }}
                    >
                        <div

                            className={cn('flex')}>
                            <div className={cn('grid gap-1.5 p-4 text-center sm:text-left')}>
                                <div
                                    className={cn('text-lg font-semibold leading-none tracking-tight text-foreground')}>
                                    整句学习
                                </div>
                                <div className={cn('text-sm text-muted-foreground')}>
                                    Improve your English using state-of-the-art AI.
                                </div>
                            </div>
                            <div className={cn('ml-auto pt-4 px-4')}>
                                <Button
                                    disabled={!canUndo}
                                    onClick={backward}
                                    variant={'ghost'} size={'icon'}>
                                    <ChevronLeft className={'text-foreground'}/>
                                </Button>
                                <Button
                                    disabled={!canRedo}
                                    onClick={forward}
                                    variant={'ghost'} size={'icon'}>
                                    <ChevronRight className={'text-foreground'}/>
                                </Button>
                                <Button
                                    onClick={clear}
                                    variant={'ghost'} size={'icon'}>
                                    <X className={'text-foreground'}/>
                                </Button>
                            </div>
                        </div>
                        <div
                            className={cn('w-full h-0 flex-1 grid gap-10 grid-cols-3 overflow-y-auto')}
                            style={{
                                gridTemplateColumns: '1fr 1.75fr 1fr',
                                gridTemplateRows: '100%'
                            }}
                        >
                            <div
                                className={cn('w-full flex overflow-y-auto h-full flex-col gap-4 pl-6 pr-10 scrollbar-none')}>

                                <ChatLeftWords className={cn('flex-shrink-0')}/>
                                <ChatLeftPhrases className={cn('flex-shrink-0')}/>
                                <ChatLeftGrammers className={cn('flex-shrink-0')}/>
                            </div>
                            <ChatCenter/>
                            <div
                                className={cn('w-full flex flex-col gap-10 pr-6 px-10 overflow-y-auto scrollbar-none')}>
                                <ChatTopicSelector className={cn('flex-shrink-0')}/>
                                {/*<ChatRightAlternative className={cn('flex-shrink-0')}/>*/}
                                <ChatRightSentences className={cn('flex-shrink-0')}/>
                            </div>
                        </div>
                    </motion.div>
                </ContextMenuTrigger>
                <ContextMenuContent
                    className={cn('z-[9999]')}
                >
                    <ContextMenuItem
                        onClick={async () => {
                            ctxMenuPlayAudio();
                        }}
                    >朗读文本</ContextMenuItem>
                    <ContextMenuItem
                        onClick={ctxMenuExplain}
                    >解释所选单词</ContextMenuItem>
                    <ContextMenuItem
                        onClick={ctxMenuPolish}
                    >润色句子</ContextMenuItem>
                    <ContextMenuItem
                        onClick={ctxMenuQuote}
                    >引用这段文本</ContextMenuItem>
                    <ContextMenuItem
                        onClick={ctxMenuCopy}
                    >复制</ContextMenuItem>
                    <ContextMenuItem
                        onClick={() => createFromSelect()}
                    >用选择内容新建对话</ContextMenuItem>
                </ContextMenuContent>
            </ContextMenu>
        </motion.div>
    );
};

Chat.defaultProps = {
    orientation: 'horizontal',
    className: ''
};

export default Chat;
