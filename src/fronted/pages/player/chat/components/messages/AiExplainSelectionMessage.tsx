import React from 'react';
import { cn } from '@/fronted/lib/utils';
import { IconOpenAI } from '@/fronted/pages/player/chat/components/icons';
import Playable from '@/fronted/components/shared/common/Playable';
import useChatPanel from '@/fronted/hooks/useChatPanel';
import MessageDeleteButton from '@/fronted/pages/player/chat/components/messages/MessageDeleteButton';
import AiCtxMenuExplainSelectMessage from '@/common/types/msg/AiCtxMenuExplainSelectMessage';
import useDpTaskViewer from '@/fronted/hooks/useDpTaskViewer';
import { AiFuncExplainSelectRes } from '@/common/types/aiRes/AiFuncExplainSelectRes';
import StrUtil from '@/common/utils/str-util';

export function AiExplainSelectionMessage({ msg }: { msg: AiCtxMenuExplainSelectMessage }) {
    const { detail: resp } = useDpTaskViewer<AiFuncExplainSelectRes>(msg.taskId);
    const updateInternalContext = useChatPanel(s => s.updateInternalContext);
    return (
        <div className={cn('group relative flex items-start')}>
            <MessageDeleteButton msg={msg} />
            <div
                className="flex size-[24px] shrink-0 select-none items-center justify-center rounded-md border bg-primary text-primary-foreground shadow-sm">
                <IconOpenAI />
            </div>
            <div className="ml-4 flex-1 space-y-2 overflow-hidden px-1 prose dark:prose-invert">
                <h2>解释</h2>
                <p><b className={'text-lg text-foreground'}><Playable>{resp?.word?.word}</Playable></b> <span
                    className={'text-foreground/50'}>[{resp?.word?.phonetic?.replace(/[[\]/]/g, '')}]</span></p>
                {resp?.word?.meaningEn && <p
                    onContextMenu={(e) => {
                        updateInternalContext(resp.word.meaningEn);
                    }}
                ><b>英文释意：</b><Playable>{resp?.word?.meaningEn}</Playable></p>}
                {resp?.word?.meaningZh && <p><b>中文释意：</b>{resp?.word?.meaningZh}</p>}
                {StrUtil.hasNonBlank(resp?.examplesSentence1, resp?.examplesSentence2, resp?.examplesSentence3) &&
                    <h3>例句</h3>}
                {resp?.examplesSentence1 && <p
                    onContextMenu={(e) => {
                        updateInternalContext(resp.examplesSentence1);
                    }}
                ><Playable>{resp?.examplesSentence1}</Playable><br />{resp?.examplesSentenceMeaning1}</p>}
                {resp?.examplesSentence2 && <p
                    onContextMenu={(e) => {
                        updateInternalContext(resp.examplesSentence2);
                    }}
                ><Playable>{resp?.examplesSentence2}</Playable><br />{resp?.examplesSentenceMeaning2}</p>}
                {resp?.examplesSentence3 && <p
                    onContextMenu={(e) => {
                        updateInternalContext(resp.examplesSentence3);
                    }}
                ><Playable>{resp?.examplesSentence3}</Playable><br />{resp?.examplesSentenceMeaning3}</p>}
            </div>
        </div>
    );
}
