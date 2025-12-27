import React from 'react';
import {cn} from "@/fronted/lib/utils";
import {IconOpenAI} from "@/fronted/pages/player/chat/components/icons";
import Md from '@/fronted/components/shared/markdown/Markdown';
import AiNormalMessage from "@/common/types/msg/AiNormalMessage";
import MsgDelete from '@/fronted/pages/player/chat/components/messages/MsgDelete';
import useDpTaskViewer from '@/fronted/hooks/useDpTaskViewer';
import {AiStringResponse} from "@/common/types/aiRes/AiStringResponse";

export function AiNormalMsg({msg}: { msg: AiNormalMessage }) {

  const {detail: resp}= useDpTaskViewer<AiStringResponse>(msg.taskId);

    return (
        <div className={cn('group relative flex items-start')}>
            <MsgDelete msg={msg}/>
            <div
                className="flex size-[24px] shrink-0 select-none items-center justify-center rounded-md border bg-primary text-primary-foreground shadow-sm">
                <IconOpenAI/>
            </div>
            <div className="ml-4 flex-1 space-y-2 overflow-hidden px-1">
                <Md>
                    {resp?.str??''}
                </Md>
            </div>
        </div>
    );
}
