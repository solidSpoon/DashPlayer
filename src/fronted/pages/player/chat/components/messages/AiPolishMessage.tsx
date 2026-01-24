import React from 'react';
import { cn } from '@/fronted/lib/utils';
import { IconOpenAI } from '@/fronted/pages/player/chat/components/ChatIcons';
import Playable from '@/fronted/components/shared/common/Playable';
import useChatPanel from '@/fronted/hooks/useChatPanel';
import AiCtxMenuPolishMessage from '@/common/types/msg/AiCtxMenuPolishMessage';
import MessageDeleteButton from '@/fronted/pages/player/chat/components/messages/MessageDeleteButton';
import { AiFuncPolishRes } from '@/common/types/aiRes/AiFuncPolish';
import useDpTaskViewer from '@/fronted/hooks/useDpTaskViewer';
import StrUtil from '@/common/utils/str-util';

export function AiPolishMessage({ msg }: { msg: AiCtxMenuPolishMessage }) {
    const { detail: resp } = useDpTaskViewer<AiFuncPolishRes>(msg.taskId);
    const updateInternalContext = useChatPanel(s => s.updateInternalContext);
    return (
        <div className={cn('group flex flex-col items-start gap-1')}>
            <div className="flex-1 space-y-2 overflow-hidden px-1 prose dark:prose-invert">
                <h2>润色</h2>
                <blockquote
                    onContextMenu={(e) => {
                        updateInternalContext(msg.origin);
                    }}
                >
                    <p><Playable>{msg.origin}</Playable></p>
                </blockquote>
                {StrUtil.hasNonBlank(resp?.edit1, resp?.edit2, resp?.edit3) && <h4>这个句子有如下几种表达方式:</h4>}
                {resp?.edit1 && <p
                    onContextMenu={(e) => {
                        updateInternalContext(resp.edit1);
                    }}
                ><Playable>{resp?.edit1}</Playable></p>}
                {resp?.edit2 && <p
                    onContextMenu={(e) => {
                        updateInternalContext(resp.edit2);
                    }}
                ><Playable>{resp?.edit2}</Playable><br /></p>}
                {resp?.edit3 && <p
                    onContextMenu={(e) => {
                        updateInternalContext(resp.edit3);
                    }}
                ><Playable>{resp?.edit3}</Playable><br /></p>}
            </div>
            <div className="opacity-0 transition-opacity group-hover:opacity-100 px-1">
                <MessageDeleteButton msg={msg} />
            </div>
        </div>
    );
}
