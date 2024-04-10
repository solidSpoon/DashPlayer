import {cn} from "@/common/utils/Util";
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

const api = window.electron;



const ChatCenter = () => {
    const messages = useChatPanel(state => state.messages);
    const streamingMessage = useChatPanel(state => state.streamingMessage);
    console.log('msgbox', messages);

    const mapping = (msg: CustomMessage<any>) => {
        switch (msg.msgType) {
            case "human-topic":
                return <HumanTopicMsg msg={msg as HumanTopicMessage}/>;
            case "ai-welcome":
                return <AiWelcomeMsg msg={msg as AiWelcomeMessage}/>;
            default:
                return <></>
        }
    }


    return (
        <div
            className={cn('w-full grow-0 flex flex-col px-2 overflow-y-auto gap-4')}
        >
            {
                messages.map((message, index) => {
                    if (index > 0) {
                        return <>
                            <Separator className={cn('pl-12 pr-4')}/>
                            {mapping(message)}
                        </>;
                    } else {
                        return mapping(message);
                    }
                })
            }
            {streamingMessage && <>
                <Separator className={cn('pl-12 pr-4')}/>
                {mapping(streamingMessage)}
            </>}

            <div className="grid w-full mt-auto sticky bottom-0">
                <div
                    className={cn('w-full h-12 bg-gradient-to-b from-transparent to-background')}
                />
                <div className={cn('w-full grid gap-2 bg-background')}>

                    <Textarea
                        className={cn('resize-none')}
                        // value={input}
                        // onChange={(e) => {
                        //     setInput(e.target.value);
                        // }}
                        placeholder="Type your message here."/>
                    <Button
                        onClick={async () => {
                            // const message = new HumanMessage(input);
                            // const newMsgs = [...messages.filter(s => s.content), message];
                            // setMessages(newMsgs);
                            // const taskId = await api.chat(newMsgs);
                            // setTaskId(taskId);
                            // setInput('');
                        }}
                    >Send message</Button>
                </div>
            </div>
        </div>
    )
}
export default ChatCenter;
