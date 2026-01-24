import React from 'react';
import Md from '@/fronted/components/shared/markdown/Markdown';
import HumanNormalMessage from "@/common/types/msg/HumanNormalMessage";
import MessageDeleteButton from '@/fronted/pages/player/chat/components/messages/MessageDeleteButton';
import { cn } from '@/fronted/lib/utils';

export default function UserTextMessage({msg}: { msg: HumanNormalMessage }) {
    return (
        <div className="group flex flex-col items-end gap-1">
            <div className="max-w-[85%]">
                <div
                    className={cn(
                        'rounded-[24px] rounded-tr-lg bg-blue-100 px-5 py-3 text-blue-900 shadow-sm',
                        'dark:bg-blue-900 dark:text-blue-50'
                    )}
                >
                    <Md>
                        {msg.content}
                    </Md>
                </div>
            </div>
            <div className="opacity-0 transition-opacity group-hover:opacity-100 px-2">
                <MessageDeleteButton msg={msg} />
            </div>
        </div>
    );
}
