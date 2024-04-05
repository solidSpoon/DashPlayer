'use client';

import * as React from 'react';
import { cn } from '@/common/utils/Util';
import {
    Drawer, DrawerClose,
    DrawerContent,
    DrawerDescription, DrawerFooter,
    DrawerHeader,
    DrawerTitle,
    DrawerTrigger
} from '@/fronted/components/ui/drawer';
import { Button } from '@/fronted/components/ui/button';
import { CodeBlock } from '@/fronted/components/chat/codeblock';
import { BotMessage, SystemMessageBox, UserMessage } from '@/fronted/components/chat/message';
import { AIMessage, BaseMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
import { Textarea } from '@/fronted/components/ui/textarea';
import ReplyMsgBox from '@/fronted/components/chat/ReplyMsgBox';
import Separator from '@/fronted/components/Separtor';

export interface ChatProps {
    open: boolean;
    onClose: () => void;
}

const api = window.electron;
const Chat = ({ open, onClose }: ChatProps) => {
    const [messages, setMessages] = React.useState<BaseMessage[]>([
        new SystemMessage('Hello, how can I help you today?')
    ]);
    const [taskId, setTaskId] = React.useState<number>(null);
    const [input, setInput] = React.useState('');
    return (
        <Drawer
            open={open}
            onClose={onClose}
        >
            {/* <DrawerTrigger>Open</DrawerTrigger> */}
            <DrawerContent
                className={cn('focus:outline-none flex flex-col')}
                style={{
                    height: 'calc(100vh - 44px)'
                }}
            >
                <DrawerHeader>
                    <DrawerTitle>Are you absolutely sure?</DrawerTitle>
                    <DrawerDescription>This action cannot be undone.</DrawerDescription>
                </DrawerHeader>
                <div
                    className={cn('w-full h-0 flex-1 grid grid-cols-3 overflow-y-auto')}
                    style={{
                        gridTemplateColumns: '1fr 2fr 1fr',
                        gridTemplateRows: '100%'
                    }}
                >
                    <div
                        className={cn('')}
                    />
                    <div
                        className={cn('w-full grow-0 flex flex-col px-2 overflow-y-auto gap-4')}
                    >
                        {/* <div className={cn('w-full flex flex-col overflow-y-auto gap-4 h-0 flex-1')}> */}
                        {
                            messages.map((message, index) => {
                                let res = <></>;
                                if (message instanceof HumanMessage) {
                                    res = <UserMessage key={index}>
                                        {message.text}
                                    </UserMessage>;
                                } else if (message instanceof BotMessage) {
                                    res = <BotMessage key={index}>
                                        {message.text}
                                    </BotMessage>;
                                } else if (message instanceof AIMessage) {
                                    res = <BotMessage key={index}>
                                        {message.text}
                                    </BotMessage>;
                                } else if (message instanceof SystemMessage) {
                                    res = <SystemMessageBox key={index}>
                                        {message.text}
                                    </SystemMessageBox>;
                                }
                                if (index > 0) {
                                    return <>
                                        <Separator className={cn('pl-12 pr-4')} />
                                        {res}
                                    </>;
                                } else {
                                    return res;
                                }
                            })
                        }
                        {taskId && <>
                            <Separator className={cn('pl-12 pr-4')} />
                            <ReplyMsgBox taskId={taskId} onMsgFinish={(t) => {
                                setMessages([...messages, new AIMessage(t.result)]);
                                setTaskId(null);
                            }} />
                        </>}

                        <div className="grid w-full mt-auto sticky bottom-0">
                            <div
                                className={cn('w-full h-12 bg-gradient-to-b from-transparent to-background')}
                            />
                            <div className={cn('w-full grid gap-2 bg-background')}>

                                <Textarea
                                    className={cn('resize-none')}
                                    value={input}
                                    onChange={(e) => {
                                        setInput(e.target.value);
                                    }}
                                    placeholder="Type your message here." />
                                <Button
                                    onClick={async () => {
                                        const message = new HumanMessage(input);
                                        let newMsgs = [...messages, message];
                                        setMessages(newMsgs);
                                        let taskId = await api.chat(newMsgs);
                                        setTaskId(taskId);
                                        setInput('');
                                    }}
                                >Send message</Button>
                            </div>
                        </div>
                        {/* </div> */}
                    </div>
                    <div
                        className={cn('')}
                    />

                </div>
                <DrawerFooter>
                </DrawerFooter>
            </DrawerContent>
        </Drawer>

    );
};

Chat.defaultProps = {
    orientation: 'horizontal',
    className: ''
};

export default Chat;
