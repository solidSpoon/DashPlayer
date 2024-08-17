import { cn } from '@/fronted/lib/utils';
import Playable from '@/fronted/components/chat/Playable';
import useChatPanel from '@/fronted/hooks/useChatPanel';
import { Button } from '@/fronted/components/ui/button';
import { ChevronsDown } from 'lucide-react';
import { Skeleton } from '@/fronted/components/ui/skeleton';
import useDpTaskViewer from '@/fronted/hooks/useDpTaskViewer';
import { AiMakeExampleSentencesRes } from '@/common/types/aiRes/AiMakeExampleSentencesRes';

const SentencesPart = ({ tid }: { tid: number }) => {
    const { detail } = useDpTaskViewer<AiMakeExampleSentencesRes>(typeof tid === 'number' ? tid : null);
    const updateInternalContext = useChatPanel(state => state.updateInternalContext);
    return <>
        {detail?.sentences?.map((s, i) => (
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
                                className={
                                    cn('text-xs border p-1 py-0 bg-red-50 border-red-500 text-primary-foreground rounded-full',
                                        'dark:bg-red-900 dark:border-red-700 dark:text-red-100 dark:shadow-inner'
                                    )}
                            >{p}</div>
                        ))
                    }
                </div>
            </div>
        ))}
        {!detail && <><Skeleton className={'h-6'} /><Skeleton className={'h-6 mt-2'} /><Skeleton
            className={'h-6 mt-2'} /></>}
    </>;
};
const ChatRightSentences = ({ className }: {
    className: string,
}) => {

    const tids = useChatPanel(state => state.tasks.sentenceTask);
    console.log('tids', tids);
    const retry = useChatPanel(state => state.retry);
    return (

        <div className={cn('flex flex-col gap-2', className)}>
            {tids?.map((tid, i) => (
                <SentencesPart key={tid + i} tid={tid} />
            ))}
            <Button variant={'ghost'} onClick={() => retry('sentence')}
                    className={' text-gray-400 dark:text-gray-200'}>
                <ChevronsDown className={'w-4 h-4'} />
            </Button>
        </div>

    );
};

export default ChatRightSentences;
