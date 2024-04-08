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
import Md from "@/fronted/components/chat/markdown";
import ChatCenter from "@/backend/services/ChatCenter";

export interface ChatProps {
}


const api = window.electron;
const Chat = ({}: ChatProps) => {
    const sentenceT = usePlayerController(state => state.currentSentence);
    const [wordTask, setWordTask] = useState<number>(null);
    const [phraseTask, setPhraseTask] = useState<number>(null);
    const [sentenceTask, setSentenceTask] = useState<number>(null);
    const [grammarTask, setGrammarTask] = useState<number>(null);
    const [summaryTask, setSummaryTask] = useState<number>(null);
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
                    <div className={cn('text-lg font-semibold leading-none tracking-tight')}>Are you absolutely sure?
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
                    {/*<ChatLeft sentence={sentenceT.text} className={"overflow-y-auto"}*/}
                    {/*          updatePhrasePoint={setPhrasePoints}*/}
                    {/*          updateWordPoint={setWordPoints}/>*/}
                    <ChatCenter originalSentence={sentenceT} topicSentence={sentenceT.text} tasks={{
                            wordTask: wordTask,
                            phraseTask: phraseTask,
                            sentenceTask: sentenceTask,
                            grammarTask: grammarTask,
                            summaryTask: summaryTask
                        }}/>
                    {/*{wordPoints !== null && phrasePoints !== null &&*/}
                    {/*    <ChatRight sentence={sentenceT} className={"overflow-y-auto"}*/}
                    {/*               points={[...wordPoints, ...phrasePoints]}/>}*/}

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
