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
import {AiNormalMsg} from "@/fronted/components/chat/msg/AiNormalMsg";
import AiNormalMessage from "@/common/types/msg/AiNormalMessage";
import HumanNormalMsg from "@/fronted/components/chat/msg/HumanNormalMsg";
import HumanNormalMessage from "@/common/types/msg/HumanNormalMessage";
import { AiCtxMenuExplainSelectWithContextMsg } from '@/fronted/components/chat/msg/AiCtxMenuExplainSelectWithContextMsg';
import AiCtxMenuExplainSelectWithContextMessage from '@/common/types/msg/AiCtxMenuExplainSelectWithContextMessage';
import { AiCtxMenuPolishMsg } from '@/fronted/components/chat/msg/AiCtxMenuPolishMsg';
import AiCtxMenuPolishMessage from '@/common/types/msg/AiCtxMenuPolishMessage';
import { AiCtxMenuExplainSelectMsg } from '@/fronted/components/chat/msg/AiCtxMenuExplainSelectMsg';
import AiCtxMenuExplainSelectMessage from '@/common/types/msg/AiCtxMenuExplainSelectMessage';

const ChatCenter = () => {
    const messages = useChatPanel(state => state.messages);
    const streamingMessage = useChatPanel(state => state.streamingMessage);
    const sent = useChatPanel(state => state.sent);
    const [input, setInput] = React.useState<string>('');
    const inputRef = React.useRef<HTMLTextAreaElement>(null);
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
                        ref={inputRef}
                        className={cn('resize-none')}
                        value={input}
                        onChange={(e) => {
                            setInput(e.target.value);
                        }}
                        placeholder="Type your message here."/>
                    <Button
                        onClick={async () => {
                            sent(input.trim());
                            setInput('');
                            inputRef.current?.focus();
                        }}
                    >Send message</Button>
                </div>
            </div>
        </div>
    )
}
export default ChatCenter;
