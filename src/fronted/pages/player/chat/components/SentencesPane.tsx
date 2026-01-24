import React from 'react';
import { cn } from '@/fronted/lib/utils';
import Playable from '@/fronted/components/shared/common/Playable';
import useChatPanel from '@/fronted/hooks/useChatPanel';
import { Skeleton } from '@/fronted/components/ui/skeleton';
import { getRendererLogger } from '@/fronted/log/simple-logger';

const SentencesPart = ({ sentences }: { sentences: {
    sentence: string;
    meaning: string;
    points: string[];
}[] }) => {
    const updateInternalContext = useChatPanel(state => state.updateInternalContext);
    return <>
        {sentences.map((s, i) => (
            <div key={`${i}-${s.sentence ?? ''}`}
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
    </>;
};
const SentencesPane = ({ className }: {
    className: string,
}) => {

    const logger = getRendererLogger('SentencesPane');
    const analysis = useChatPanel(state => state.analysis);
    const status = useChatPanel(state => state.analysisStatus);
    const sentences = analysis?.examples?.sentences ?? [];
    logger.debug('Sentence analysis loaded', { count: sentences.length });
    return (

        <div className={cn('flex flex-col gap-2', className)}>
            {sentences.length > 0 && (
                <SentencesPart sentences={sentences} />
            )}
            {sentences.length === 0 && status === 'streaming' && (
                <>
                    <Skeleton className={'h-6'} />
                    <Skeleton className={'h-6 mt-2'} />
                    <Skeleton className={'h-6 mt-2'} />
                </>
            )}
        </div>

    );
};

export default SentencesPane;
