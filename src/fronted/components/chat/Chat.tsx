'use client';

import * as React from 'react';
import {cn, p, strBlank} from '@/common/utils/Util';
import {motion} from 'framer-motion';
import ChatLeftWords from "@/fronted/components/chat/ChatLeftWords";
import ChatLeftPhrases from "@/fronted/components/chat/ChatLeftPhrases";
import ChatLeftGrammers from "@/fronted/components/chat/ChatLeftGrammers";
import ChatRightSentences from "@/fronted/components/chat/ChatRightSentences";
import ChatCenter from "@/fronted/components/chat/ChatCenter";
import ChatTopicSelecter from "@/fronted/components/chat/ChatRightSumary";

import {
    ContextMenu,
    ContextMenuContent,
    ContextMenuItem,
    ContextMenuTrigger
} from "@/fronted/components/ui/context-menu";
import {useEffect, useRef} from "react";
import useChatPanel from "@/fronted/hooks/useChatPanel";

const Chat = () => {
    const createTopic = useChatPanel(s => s.createTopic);
    const ref = useRef<HTMLDivElement>(null);



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
                modal={true}
            >
                <ContextMenuTrigger
                >
                    <motion.div
                        ref={ref}
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
                        <div className={cn('grid gap-1.5 p-4 text-center sm:text-left')}>
                            <div className={cn('text-lg font-semibold leading-none tracking-tight')}>Are you absolutely
                                sure?
                            </div>
                            <div className={cn('text-sm text-muted-foreground')}>This action cannot be undone.</div>
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
                                <ChatTopicSelecter className={cn('flex-shrink-0')}/>
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
                        onClick={() => {
                            let select = p(window.getSelection()?.toString());
                            console.log('sssss', select,window?.getSelection());
                            // 去除换行符
                            select = select?.replace(/\n/g, '');
                            if (!strBlank(select)) {
                                createTopic({
                                    content: select
                                });
                            }
                        }}
                    >朗读文本</ContextMenuItem>
                    <ContextMenuItem>用选择内容新建对话</ContextMenuItem>
                    <ContextMenuItem>用所选单词造句</ContextMenuItem>
                    <ContextMenuItem>查询所选单词</ContextMenuItem>
                    <ContextMenuItem>查询所选词组</ContextMenuItem>
                    <ContextMenuItem>同义句</ContextMenuItem>
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
