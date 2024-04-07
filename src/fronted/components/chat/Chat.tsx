'use client';

import * as React from 'react';
import {cn} from '@/common/utils/Util';
import {Button} from '@/fronted/components/ui/button';
import {BotMessage, SystemMessageBox, UserMessage} from '@/fronted/components/chat/message';
import {AIMessage, BaseMessage, HumanMessage, SystemMessage} from '@langchain/core/messages';
import {Textarea} from '@/fronted/components/ui/textarea';
import ReplyMsgBox from '@/fronted/components/chat/ReplyMsgBox';
import Separator from '@/fronted/components/Separtor';
import usePlayerController from '@/fronted/hooks/usePlayerController';
import {useEffect, useState} from 'react';
import SentenceT from '@/common/types/SentenceT';
import {motion} from 'framer-motion';
import ChatLeft from "@/fronted/components/chat/ChatLeft";
import ChatRight from "@/fronted/components/chat/ChatRight";

export interface ChatProps {
}

const api = window.electron;
const Chat = ({}: ChatProps) => {
    const sentenceT = usePlayerController(state => state.currentSentence);
    const [messages, setMessages] = useState<BaseMessage[]>([]);
    const [chatTaskId, setChatTaskId] = React.useState<number>(null);
    // const [analyzeTaskId, setAnalyzeTaskId] = React.useState<number>(null);
    const [input, setInput] = React.useState('');
    const [wordPoints, setWordPoints] = React.useState<string[]>(null);
    const [phrasePoints, setPhrasePoints] = React.useState<string[]>(null);
    useEffect(() => {
        const runEffect = async () => {
            const subtitleAround: SentenceT[] = usePlayerController.getState().getSubtitleAround(sentenceT?.index ?? 0);
            const taskId = await api.aiAnalyzeCurrent({
                sentence: sentenceT.text,
                context: subtitleAround.map(s => s.text)
            });
            // const taskId = await api.aiAnalyzeNewWords(sentenceT.text);
            setChatTaskId(taskId);
        };
        if (messages.length === 0) {
            setMessages(state => [...state.filter(e => e.content), new HumanMessage(`请帮我分析这句话：${sentenceT.text}`)]);
            runEffect();
        }
        console.log('msgggggggggg', sentenceT);
    }, []);
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
            <motion.div
                className={cn(
                    'focus:outline-none flex flex-col fixed top-[44px] z-[998] right-0 w-full bg-background pb-4',
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
                    <div className={cn('text-lg font-semibold leading-none tracking-tight')}>Are you absolutely sure?
                    </div>
                    <div className={cn('text-sm text-muted-foreground')}>This action cannot be undone.</div>
                </div>
                <div
                    className={cn('w-full h-0 flex-1 grid grid-cols-3 overflow-y-auto')}
                    style={{
                        gridTemplateColumns: '1fr 2fr 1fr',
                        gridTemplateRows: '100%'
                    }}
                >
                    <ChatLeft sentence={sentenceT.text} className={""} updatePhrasePoint={setPhrasePoints}
                              updateWordPoint={setWordPoints}/>
                    <div
                        className={cn('w-full grow-0 flex flex-col px-2 overflow-y-auto gap-4')}
                    >
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
                                        <Separator className={cn('pl-12 pr-4')}/>
                                        {res}
                                    </>;
                                } else {
                                    return res;
                                }
                            })
                        }
                        {chatTaskId && <>
                            <Separator className={cn('pl-12 pr-4')}/>
                            <ReplyMsgBox taskId={chatTaskId} onMsgFinish={(t) => {
                                setMessages(state => [...state.filter(e => e.content), new AIMessage(t.result)]);
                                setChatTaskId(null);
                            }}/>
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
                                    placeholder="Type your message here."/>
                                <Button
                                    onClick={async () => {
                                        const message = new HumanMessage(input);
                                        const newMsgs = [...messages.filter(s => s.content), message];
                                        setMessages(newMsgs);
                                        const taskId = await api.chat(newMsgs);
                                        setChatTaskId(taskId);
                                        setInput('');
                                    }}
                                >Send message</Button>
                            </div>
                        </div>
                    </div>
                    {wordPoints !== null && phrasePoints !== null &&
                        <ChatRight sentence={sentenceT.text} className={""} points={[...wordPoints, ...phrasePoints]}/>}

                </div>
            </motion.div>
        </motion.div>
    );
};

Chat.defaultProps = {
    orientation: 'horizontal',
    className: ''
};

export default Chat;
