import React from 'react';
import Md from '@/fronted/components/shared/markdown/Markdown';
import HumanNormalMessage from "@/common/types/msg/HumanNormalMessage";
import MessageDeleteButton from '@/fronted/pages/player/chat/components/messages/MessageDeleteButton';
import { Avatar, AvatarFallback } from '@/fronted/components/ui/avatar';
import { cn } from '@/fronted/lib/utils';

export default function UserTextMessage({msg}: { msg: HumanNormalMessage }) {
    return (
        <div className="group relative flex items-start gap-3">
            <MessageDeleteButton msg={msg} />
            <Avatar className="size-9 border bg-background shadow-sm">
                <AvatarFallback className="text-xs font-semibold text-foreground">ME</AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-2">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">You</div>
                <div
                    className={cn(
                        'rounded-2xl border border-border/80 bg-muted/60 px-4 py-3 shadow-sm',
                        'backdrop-blur-sm'
                    )}
                >
                    <Md>
                        {msg.content}
                    </Md>
                </div>
            </div>
        </div>
    );
}
