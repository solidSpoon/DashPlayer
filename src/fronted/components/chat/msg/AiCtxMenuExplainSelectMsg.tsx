import { cn } from '@/fronted/lib/utils';
import { IconOpenAI } from '@/fronted/components/chat/icons';
import AiCtxMenuExplainSelectMessage from '@/common/types/msg/AiCtxMenuExplainSelectMessage';
import Playable from '@/fronted/components/chat/Playable';
import { strBlank, strNotBlank } from '@/common/utils/Util';

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
                <p><b className={'text-lg text-foreground'}><Playable>{resp?.word?.word}</Playable></b> <span
                    className={'text-foreground/50'}>{resp?.word?.phonetic}</span></p>
                {resp?.word?.meaningEn && <p><b>英文释意：</b>{resp?.word?.meaningEn}</p>}
                {resp?.word?.meaningZh && <p><b>中文释意：</b>{resp?.word?.meaningZh}</p>}
                {resp?.word?.meaningInSentence && <p><b>在这句话中的意思：</b>{resp?.word?.meaningInSentence}</p>}
                {(strNotBlank(resp?.examplesSentence1) || strNotBlank(resp?.examplesSentence2) || strNotBlank(resp?.examplesSentence3)) && <h3>例句</h3>}
                {resp?.examplesSentence1 && <p><Playable>{resp?.examplesSentence1}</Playable><br />{resp?.examplesSentenceMeaning1}</p>}
                {resp?.examplesSentence2 && <p><Playable>{resp?.examplesSentence2}</Playable><br />{resp?.examplesSentenceMeaning2}</p>}
                {resp?.examplesSentence3 && <p><Playable>{resp?.examplesSentence3}</Playable><br />{resp?.examplesSentenceMeaning3}</p>}
            </div>
        </div>
    );
}
