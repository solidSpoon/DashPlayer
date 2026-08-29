import React from 'react';
import { History } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/fronted/components/ui/tooltip';
import { Button } from '@/fronted/components/ui/button';
import { cn } from '@/fronted/lib/utils';
import { Sentence } from '@/common/types/SentenceC';
import TranslatableLineWrapper from './TranslatableLineWrapper';

interface TranslatableLinePodcastParam {
    sentence: Sentence;
    adjusted: boolean;
    clearAdjust: () => void;
    className?: string;
}

const TranslatableLinePodcast = ({
    sentence,
    adjusted,
    clearAdjust,
    className
}: TranslatableLinePodcastParam) => {

    const text = sentence.text;

    return text === undefined ? (
        <div />
    ) : (
        <div
            className={cn(
                'relative flex justify-between items-start w-full overflow-visible pointer-events-auto',
                'shadow-stone-100 dark:shadow-neutral-600',
                className
            )}
        >
            <div className={cn('w-10 h-full translate-x-2.5 flex justify-center items-center')}>
                {adjusted && (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    onClick={clearAdjust}
                                    variant={'ghost'} size={'icon'} className="w-8 h-8 rounded-full hover:bg-stone-300/60 dark:hover:bg-neutral-600/60">
                                    <History className="w-5 h-5 stroke-[2.2] text-stone-800 dark:text-neutral-200" />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                点击重置当前句子时间戳
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                )}
            </div>
            <TranslatableLineWrapper
                sentence={sentence}
                adjusted={adjusted}
                clearAdjust={clearAdjust}
                variant={'plain'}
            />
            <div className={cn('w-10 h-full')} />
        </div>
    );
};

export default TranslatableLinePodcast;

TranslatableLinePodcast.defaultProps = {
    className: ''
};
