import React from 'react';
import { cn } from '@/fronted/lib/utils';
import Md from '@/fronted/components/shared/markdown/Markdown';
import MessageDeleteButton from '@/fronted/pages/player/chat/components/messages/MessageDeleteButton';
import AiStreamingMessageModel from '@/common/types/msg/AiStreamingMessage';
import { spinner } from '@/fronted/pages/player/chat/components/Spinner';

const AiStreamingMessage = ({ msg }: { msg: AiStreamingMessageModel }) => {
    return (
        <div className={cn('group flex flex-col items-start gap-1')}>
            <div className="flex-1 max-w-full overflow-hidden">
                <div className="px-1 py-1 text-foreground">
                    {msg.content ? (
                        <Md>{msg.content}</Md>
                    ) : (
                        <div className="flex items-center gap-2 text-muted-foreground">
                            {spinner}
                            <span className="text-sm">Thinking...</span>
                        </div>
                    )}
                </div>
            </div>
            <div className="opacity-0 transition-opacity group-hover:opacity-100 px-1">
                <MessageDeleteButton msg={msg} />
            </div>
        </div>
    );
};

export default AiStreamingMessage;
