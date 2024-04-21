import { cn } from '@/fronted/lib/utils';
import { IconOpenAI } from '@/fronted/components/chat/icons';
import Playable from '@/fronted/components/chat/Playable';
import useChatPanel from '@/fronted/hooks/useChatPanel';
import AiCtxMenuPolishMessage from '@/common/types/msg/AiCtxMenuPolishMessage';
import { strNotBlank } from '@/common/utils/Util';
import MsgDelete from '@/fronted/components/chat/msg/MsgDelete';

export function AiCtxMenuPolishMsg({ msg }: { msg: AiCtxMenuPolishMessage }) {
    const resp = msg.resp;
    const updateInternalContext = useChatPanel(s => s.updateInternalContext);
    return (
        <div className={cn('group relative flex items-start')}>
            <MsgDelete msg={msg}/>
            <div
                className="flex size-[24px] shrink-0 select-none items-center justify-center rounded-md border bg-primary text-primary-foreground shadow-sm">
                <IconOpenAI />
            </div>
            <div className="ml-4 flex-1 space-y-2 overflow-hidden px-1 prose dark:prose-invert">
                <h2>润色</h2>
                <blockquote
                    onContextMenu={(e) => {
                        updateInternalContext(msg.origin);
                    }}
                >
                    <p><Playable>{msg.origin}</Playable></p>
                </blockquote>
                {(strNotBlank(resp?.edit1) || strNotBlank(resp?.edit2) || strNotBlank(resp?.edit3)) && <h4>这个句子有如下几种表达方式:</h4>}
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
        </div>
    );
}
