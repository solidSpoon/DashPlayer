import React from 'react';
import { cn } from '@/fronted/lib/utils';
import Playable from '@/fronted/components/shared/common/Playable';
import useChatPanel from '@/fronted/hooks/useChatPanel';
import { Skeleton } from '@/fronted/components/ui/skeleton';
import Md from '@/fronted/components/shared/markdown/Markdown';
import StrUtil from '@/common/utils/str-util';
import { getRendererLogger } from '@/fronted/log/simple-logger';
import { Separator } from '@/fronted/components/ui/separator';

const UnifiedAnalysisPane = ({ className }: {
    className?: string,
}) => {
    const logger = getRendererLogger('UnifiedAnalysisPane');
    const analysis = useChatPanel(state => state.analysis);
    const status = useChatPanel(state => state.analysisStatus);
    const vocabDetail = analysis?.vocab;
    const phraseDetail = analysis?.phrases;
    const grammarDetail = analysis?.grammar;

    logger.debug('AI analysis detail loaded', { vocab: vocabDetail, phrase: phraseDetail, grammar: grammarDetail });

    const isLoading = status === 'streaming' && !vocabDetail && !phraseDetail && !grammarDetail;

    if (isLoading) {
        return (
            <div className={cn('flex flex-col gap-6 px-2', className)}>
                 <div className="space-y-3">
                    <Skeleton className="h-4 w-20 rounded" />
                    <Skeleton className="h-12 w-full rounded-xl" />
                    <Skeleton className="h-12 w-full rounded-xl" />
                </div>
                 <div className="space-y-3">
                    <Skeleton className="h-4 w-20 rounded" />
                    <Skeleton className="h-12 w-full rounded-xl" />
                </div>
                <div className="space-y-3">
                    <Skeleton className="h-4 w-20 rounded" />
                    <Skeleton className="h-24 w-full rounded-xl" />
                </div>
            </div>
        );
    }

    return (
        <div className={cn('flex flex-col gap-8 text-foreground/90 px-1', className)}>
            
            {/* Vocabulary Section */}
            {(vocabDetail?.hasNewWord && (vocabDetail.words?.length ?? 0) > 0) && (
                <div className="flex flex-col gap-3">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">本句生词</h3>
                    <div className="flex flex-col gap-3">
                        {vocabDetail?.words?.map((word, i) => (
                            <div key={i} className="flex flex-col gap-1 rounded-xl bg-secondary/30 p-3 transition-colors hover:bg-secondary/50">
                                <div className="flex items-center gap-2">
                                    <Playable className="font-semibold text-lg text-primary">{word.word}</Playable>
                                    <span className="text-sm text-muted-foreground font-mono bg-muted/50 px-1.5 py-0.5 rounded">
                                        {word.phonetic}
                                    </span>
                                </div>
                                <div className="text-sm text-foreground/80 leading-relaxed">{word.meaning}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Phrases Section */}
            {(phraseDetail?.hasPhrase && (phraseDetail.phrases?.length ?? 0) > 0) && (
                 <div className="flex flex-col gap-3">
                     {/* Add a subtle separator if vocabulary exists above */}
                    {vocabDetail?.hasNewWord && <Separator className="mb-2 opacity-50" />}
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">本句词组</h3>
                    <div className="flex flex-col gap-3">
                        {phraseDetail?.phrases?.map((phrase, i) => (
                            <div key={i} className="flex flex-col gap-1 rounded-xl bg-secondary/30 p-3 transition-colors hover:bg-secondary/50">
                                <Playable className="font-medium text-base text-primary/90">{phrase.phrase}</Playable>
                                <div className="text-sm text-foreground/80 leading-relaxed">{phrase.meaning}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Grammar Section */}
            {(StrUtil.isNotBlank(grammarDetail?.grammarsMd)) && (
                <div className="flex flex-col gap-3">
                     {/* Add a subtle separator if prev sections exist */}
                    {(vocabDetail?.hasNewWord || phraseDetail?.hasPhrase) && <Separator className="mb-2 opacity-50" />}
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">本句语法</h3>
                    <div className="prose prose-sm dark:prose-invert max-w-none 
                        prose-p:text-foreground/80 prose-p:leading-relaxed prose-p:my-1
                        prose-headings:text-foreground/90 prose-headings:font-medium
                        prose-strong:text-primary/90 prose-strong:font-semibold
                        prose-code:bg-muted/50 prose-code:rounded prose-code:px-1 prose-code:py-0.5 prose-code:before:content-none prose-code:after:content-none
                        bg-secondary/10 rounded-xl p-1">
                        <Md>
                            {grammarDetail?.grammarsMd ?? ''}
                        </Md>
                    </div>
                </div>
            )}

            {/* Empty State (if analysis is done but nothing found) */}
            {status === 'done' && !vocabDetail?.hasNewWord && !phraseDetail?.hasPhrase && !StrUtil.isNotBlank(grammarDetail?.grammarsMd) && (
                <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                    <p>本句没有特别的生词或语法点</p>
                </div>
            )}
        </div>
    );
};

export default UnifiedAnalysisPane;
