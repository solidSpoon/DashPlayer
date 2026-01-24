import React from 'react';
import { cn } from '@/fronted/lib/utils';
import { Avatar, AvatarFallback } from '@/fronted/components/ui/avatar';
import { Badge } from '@/fronted/components/ui/badge';
import Md from '@/fronted/components/shared/markdown/Markdown';
import MessageDeleteButton from '@/fronted/pages/player/chat/components/messages/MessageDeleteButton';
import AiStreamingMessageModel from '@/common/types/msg/AiStreamingMessage';
import { spinner } from '@/fronted/pages/player/chat/components/Spinner';

const AiStreamingMessage = ({ msg }: { msg: AiStreamingMessageModel }) => {
    return (
        <div className={cn('group relative flex items-start gap-3')}>
            <MessageDeleteButton msg={msg} />
            <Avatar className="size-9 border bg-background shadow-sm">
                <AvatarFallback className="text-xs font-semibold text-primary">AI</AvatarFallback>
            </Avatar>
            <div className="flex-1 space-y-2">
                <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Dash AI</span>
                    {msg.isStreaming && (
                        <Badge variant="secondary" className="flex items-center gap-1">
                            <span className="text-[10px] uppercase">Typing</span>
                        </Badge>
                    )}
                </div>
                <div
                    className={cn(
                        'rounded-2xl border border-border/80 bg-background/70 px-4 py-3 shadow-sm',
                        'backdrop-blur-sm'
                    )}
                >
                    {msg.content ? (
                        <Md>{msg.content}</Md>
                    ) : (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            {spinner}
                            <span>AI is thinking...</span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AiStreamingMessage;
