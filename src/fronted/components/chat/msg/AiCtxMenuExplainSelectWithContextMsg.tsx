import { cn } from '@/fronted/lib/utils';
import { IconOpenAI } from '@/fronted/components/chat/icons';
import AiCtxMenuExplainSelectWithContextMessage from '@/common/types/msg/AiCtxMenuExplainSelectWithContextMessage';
import Playable from '@/fronted/components/chat/Playable';
import { strNotBlank } from '@/common/utils/Util';
import useChatPanel from '@/fronted/hooks/useChatPanel';
import MsgDelete from '@/fronted/components/chat/msg/MsgDelete';
import { AiFuncExplainSelectWithContextRes } from '@/common/types/aiRes/AiFuncExplainSelectWithContextRes';
import useDpTaskViewer from '@/fronted/hooks/useDpTaskViewer';

export function AiCtxMenuExplainSelectWithContextMsg({ msg }: { msg: AiCtxMenuExplainSelectWithContextMessage }) {
    const { detail: resp } = useDpTaskViewer<AiFuncExplainSelectWithContextRes>(msg.taskId);
    const updateInternalContext = useChatPanel(s => s.updateInternalContext);
    return (
        <div className={cn('group relative flex items-start')}>
            <MsgDelete msg={msg}/>
            <div
                className="flex size-[24px] shrink-0 select-none items-center justify-center rounded-md border bg-primary text-primary-foreground shadow-sm">
                <IconOpenAI />
            </div>
            <div className="ml-4 flex-1 space-y-2 overflow-hidden px-1 prose dark:prose-invert">
                <h2>解释</h2>
                <blockquote
                    onContextMenu={(e) => {
                        updateInternalContext(resp?.sentence?.sentence);
                    }}
                >
                    <p><Playable>{resp?.sentence?.sentence}</Playable><br />{resp?.sentence?.meaning}</p>
                </blockquote>
                <p><b className={'text-lg text-foreground'}><Playable>{resp?.word?.word}</Playable></b> <span
                    className={'text-foreground/50'}>[{resp?.word?.phonetic?.replace(/[[\]/]/g, "")}]</span></p>
                {resp?.word?.meaningEn && <p
                    onContextMenu={(e) => {
                        updateInternalContext(resp.word.meaningEn);
                    }}
                ><b>英文释意：</b><Playable>{resp?.word?.meaningEn}</Playable></p>}
                {resp?.word?.meaningZh && <p><b>中文释意：</b>{resp?.word?.meaningZh}</p>}
                {resp?.word?.meaningInSentence && <p><b>在这句话中的意思：</b>{resp?.word?.meaningInSentence}</p>}
                {(strNotBlank(resp?.examplesSentence1) || strNotBlank(resp?.examplesSentence2) || strNotBlank(resp?.examplesSentence3)) && <h3>例句</h3>}
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
