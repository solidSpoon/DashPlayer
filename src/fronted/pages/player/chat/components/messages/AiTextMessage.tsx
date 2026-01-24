import React from 'react';
import { cn } from "@/fronted/lib/utils";
import Md from '@/fronted/components/shared/markdown/Markdown';
import AiNormalMessage from "@/common/types/msg/AiNormalMessage";
import MessageDeleteButton from '@/fronted/pages/player/chat/components/messages/MessageDeleteButton';
import useDpTaskViewer from '@/fronted/hooks/useDpTaskViewer';
import { AiStringResponse } from "@/common/types/aiRes/AiStringResponse";

export function AiTextMessage({msg}: { msg: AiNormalMessage }) {

    const { detail: resp } = useDpTaskViewer<AiStringResponse>(msg.taskId);

    return (
        <div className={cn('group flex flex-col items-start gap-1')}>
            <div className="flex-1 max-w-full overflow-hidden">
                <div className="px-1 py-1 text-foreground">
                    <Md>
                        {resp?.str ?? ''}
                    </Md>
                </div>
            </div>
            <div className="opacity-0 transition-opacity group-hover:opacity-100 px-1">
                <MessageDeleteButton msg={msg} />
            </div>
        </div>
    );
}
