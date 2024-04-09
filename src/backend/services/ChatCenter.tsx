import {cn} from "@/common/utils/Util";
import {AIMessage, BaseMessage, HumanMessage, SystemMessage} from "@langchain/core/messages";
import {BotMessage, SystemMessageBox, UserMessage} from "@/fronted/components/chat/message";
import Separator from "@/fronted/components/Separtor";
import ReplyMsgBox from "@/fronted/components/chat/ReplyMsgBox";
import {Textarea} from "@/fronted/components/ui/textarea";
import {Button} from "@/fronted/components/ui/button";
import * as React from "react";
import {useEffect, useState} from "react";
import SentenceT from "@/common/types/SentenceT";
import usePlayerController from "@/fronted/hooks/usePlayerController";

const api = window.electron;
export interface ChatCenterProps {
    topicSentence: string;
    originalSentence: SentenceT;
}
const ChatCenter = ({topicSentence, originalSentence }:ChatCenterProps) => {
    const [messages, setMessages] = useState<BaseMessage[]>([]);
    const [taskId, setTaskId] = useState<number>(null);
    const [input, setInput] = useState<string>('');
    useEffect(() => {
        const runEffect = async () => {
            const subtitleAround: SentenceT[] = usePlayerController.getState().getSubtitleAround(originalSentence?.index ?? 0);
            const taskId = await api.aiAnalyzeCurrent({
                sentence: topicSentence,
                context: subtitleAround.map(s => s.text)
            });
            // const taskId = await api.aiAnalyzeNewWords(sentenceT.text);
            setTaskId(taskId);
        };
        if (messages.length === 0) {
            setMessages(state => [...state.filter(e => e.content), new HumanMessage(`请帮我分析这句话：${topicSentence}`)]);
            runEffect();
        }
    }, [messages.length, topicSentence, originalSentence]);
    return (
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
            {taskId && <>
                <Separator className={cn('pl-12 pr-4')}/>
                <ReplyMsgBox taskId={taskId} onMsgFinish={(t) => {
                    setMessages(state => [...state.filter(e => e.content), new AIMessage(t.result)]);
                    setTaskId(null);
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
                            setTaskId(taskId);
                            setInput('');
                        }}
                    >Send message</Button>
                </div>
            </div>
        </div>
    )
}
export default ChatCenter;
