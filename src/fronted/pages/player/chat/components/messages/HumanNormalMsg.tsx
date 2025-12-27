import React from 'react';
import {IconUser} from "@/fronted/pages/player/chat/components/icons";
import Md from '@/fronted/components/shared/markdown/Markdown';
import HumanNormalMessage from "@/common/types/msg/HumanNormalMessage";
import MsgDelete from '@/fronted/pages/player/chat/components/messages/MsgDelete';

export default function HumanNormalMsg({msg}: { msg: HumanNormalMessage }) {
    return (
        <div className="group relative flex items-start">
            <MsgDelete msg={msg}/>
            <div
                className="flex size-[25px] shrink-0 select-none items-center justify-center rounded-md border bg-background shadow-sm">
                <IconUser/>
            </div>
            <div className="ml-4 flex-1 space-y-2 overflow-hidden pl-2">
                <Md>
                    {msg.content}
                </Md>
            </div>
        </div>
    );
}
