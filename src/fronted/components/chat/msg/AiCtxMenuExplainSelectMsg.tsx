import { cn } from '@/fronted/lib/utils';
import { IconOpenAI } from '@/fronted/components/chat/icons';
import Md from '@/fronted/components/chat/markdown';
import AiCtxMenuExplainSelectMessage from '@/common/types/msg/AiCtxMenuExplainSelectMessage';
import { html } from 'common-tags';
import Playable from '@/fronted/components/chat/Playable';

export function AiCtxMenuExplainSelectMsg({ msg }: { msg: AiCtxMenuExplainSelectMessage }) {
    const resp = msg.resp;
    return (
        <div className={cn('group relative flex items-start')}>
            <div
                className="flex size-[24px] shrink-0 select-none items-center justify-center rounded-md border bg-primary text-primary-foreground shadow-sm">
                <IconOpenAI />
            </div>
            <div className="ml-4 flex-1 space-y-2 overflow-hidden px-1 prose">
                <h2>解释</h2>
                <blockquote>
                    <p><Playable>{resp?.sentence?.sentence}</Playable><br />{resp?.sentence?.meaning}</p>
                </blockquote>
                <p><b className={'text-lg text-foreground'}><Playable>{resp?.word?.word}</Playable></b> <span className={'text-foreground/50'}>{resp?.word?.phonetic}</span></p>
                <p><b>本意：</b>{resp?.word?.meaning}</p>
                <p><b>在这句话中的意思：</b>{resp?.word?.meaningInSentence}</p>
                {resp.idiom ? `<p>另外，"${resp?.idiom}" 也是一个俗语，意思是 ${resp?.idiom?.meaning}。</p>` : ''}

            </div>
        </div>
    );
}
