import React from 'react';
import { cn } from "@/fronted/lib/utils";
import Md from '@/fronted/components/shared/markdown/Markdown';
import AiNormalMessage from "@/common/types/msg/AiNormalMessage";
import MessageDeleteButton from '@/fronted/pages/player/chat/components/messages/MessageDeleteButton';
import useDpTaskViewer from '@/fronted/hooks/useDpTaskViewer';
import { AiStringResponse } from "@/common/types/aiRes/AiStringResponse";
import { Avatar, AvatarFallback } from '@/fronted/components/ui/avatar';

export function AiTextMessage({msg}: { msg: AiNormalMessage }) {

    const { detail: resp } = useDpTaskViewer<AiStringResponse>(msg.taskId);

    return (
        <div className={cn('group relative flex items-start gap-3')}>
            <MessageDeleteButton msg={msg} />
            <Avatar className="size-9 border bg-background shadow-sm">
                <AvatarFallback className="text-xs font-semibold text-primary">AI</AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Dash AI</div>
                <div
                    className={cn(
                        'rounded-2xl border border-border/80 bg-background/70 px-4 py-3 shadow-sm',
                        'backdrop-blur-sm'
                    )}
                >
                    <Md>
                        {resp?.str ?? ''}
                    </Md>
                </div>
            </div>
        </div>
    );
}
