import React, { useEffect } from 'react';
import { cn } from '@/fronted/lib/utils';
import Playable from '@/fronted/components/shared/common/Playable';
import useChatPanel from '@/fronted/features/chat/chatStore';
import { Skeleton } from '@/fronted/components/ui/skeleton';
import { getRendererLogger } from '@/fronted/log/simple-logger';

const SentencesPart = ({ sentences }: { sentences: {
    sentence: string;
    meaning: string;
    points: string[];
}[] }) => {
    const updateInternalContext = useChatPanel(state => state.updateInternalContext);
    return <div className="flex flex-col gap-2">
        {sentences.map((s, i) => (
            <div key={`${i}-${s.sentence ?? ''}`}
                 onContextMenu={() => updateInternalContext(s?.sentence)}
                 className="bg-secondary/30 flex flex-col justify-between px-4 py-2 rounded-xl transition-colors hover:bg-secondary/50">
                <Playable
                    className="text-base font-medium text-foreground/90">{s?.sentence}</Playable>
                <div
                    className="text-sm text-muted-foreground mt-0.5">{s?.meaning}</div>
                <div className={'flex flex-wrap gap-x-3 gap-y-0.5 mt-2'}>
                    {
                        s?.points?.map((p, j) => (
                            <div
                                key={j}
                                className={
                                    cn('text-[10px] font-bold uppercase tracking-wider text-red-500/60 dark:text-red-400/60'
                                    )}
                            >#{p}</div>
                        ))
                    }
                </div>
            </div>
        ))}
    </div>;
};
const SentencesPane = ({ className }: {
    className: string,
}) => {

    const logger = getRendererLogger('SentencesPane');
    const analysis = useChatPanel(state => state.analysis);
    const status = useChatPanel(state => state.analysisStatus);
    const sentences = (analysis?.examples?.sentences ?? []).filter((sentence) => {
        return Boolean(sentence?.sentence || sentence?.meaning);
    });
    // 渲染体内不打日志；分析完成时记录一次句子数量。
    useEffect(() => {
        if (status === 'done') {
            // 分析完成属关键生命周期，生产环境（info 级）也应可回溯渲染端是否收到结果。
            logger.info('Sentence analysis loaded', { count: sentences.length });
        }
    }, [status, sentences.length, logger]);
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
