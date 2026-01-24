import React from 'react';
import { cn } from "@/fronted/lib/utils";
import Md from '@/fronted/components/shared/markdown/Markdown';
import AiNormalMessage from "@/common/types/msg/AiNormalMessage";
import MessageDeleteButton from '@/fronted/pages/player/chat/components/messages/MessageDeleteButton';
import useDpTaskViewer from '@/fronted/hooks/useDpTaskViewer';
import { AiStringResponse } from "@/common/types/aiRes/AiStringResponse";
import AiWelcomeMessage from '@/common/types/msg/AiWelcomeMessage';

export function AiTextMessage({msg}: { msg: AiNormalMessage | AiWelcomeMessage }) {

    const taskId = 'taskId' in msg ? msg.taskId : null;
    const { detail: resp } = useDpTaskViewer<AiStringResponse>(taskId);
    const content = 'content' in msg ? msg.content : (resp?.str ?? '');

    return (
        <div className={cn('group flex flex-col items-start gap-1')}>
            <div className="flex-1 max-w-full overflow-hidden">
                <div className="px-1 py-1 text-foreground">
                    <Md>{content}</Md>
                </div>
            </div>
            <div className="opacity-0 transition-opacity group-hover:opacity-100 px-1">
                <MessageDeleteButton msg={msg} />
            </div>
        </div>
    );
}
