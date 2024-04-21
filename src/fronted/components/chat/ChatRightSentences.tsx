import {cn} from "@/fronted/lib/utils";
import Playable from "@/fronted/components/chat/Playable";
import useChatPanel from "@/fronted/hooks/useChatPanel";
import { Button } from '@/fronted/components/ui/button';
import { ChevronsDown } from 'lucide-react';

const ChatRightSentences = ({className}: {
    className: string,
}) => {

    const res = useChatPanel(state => state.newSentence);
    const updateInternalContext = useChatPanel(state => state.updateInternalContext);
    const retry = useChatPanel(state => state.retry);
    console.log('res', res)
    const sentences = useChatPanel.getState().internal.newSentenceHistory.flatMap(s => s.sentences);
    res?.sentences?.forEach(s => {
        if (!sentences.find(ss => ss.sentence === s.sentence)) {
            sentences.push(s);
        }
    });
    return (

        <div className={cn('flex flex-col gap-2', className)}>
            {sentences?.map((s, i) => (
                <div key={s.sentence + i}
                     onContextMenu={() => updateInternalContext(s?.sentence)}
                     className="bg-secondary flex flex-col justify-between px-4 py-2 rounded">
                    <Playable
                        className="text-base text-gray-700 text-secondary-foreground">{s?.sentence}</Playable>
                    <div
                        tabIndex={0}
                        className=" text-sm text-gray-500">{s?.meaning}</div>
                    <div className={'flex flex-wrap gap-2 mt-2'}>
                        {
                            s?.points?.map((p, j) => (
                                <div
                                    key={j}
                                     className="text-xs border p-1 py-0 bg-red-50 border-red-500 text-primary-foreground rounded-full">{p}</div>
                            ))
                        }
                    </div>


                </div>
            ))}
            {!res && <div className="text-lg text-gray-700">生成例句中...</div>}
            <Button variant={'ghost'} onClick={()=>retry('sentence')}
                    className={' text-gray-400 dark:text-gray-200'}>
                <ChevronsDown  className={'w-4 h-4'} />
            </Button>
        </div>

    )
}

export default ChatRightSentences;
