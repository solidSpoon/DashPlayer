import { AiOutlineFieldTime } from 'react-icons/ai';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/fronted/components/ui/tooltip';
import { Button } from '@/fronted/components/ui/button';
import { cn } from '@/fronted/lib/utils';
import { Sentence } from '@/common/types/SentenceC';
import TranslatableLineWrapper from "@/fronted/pages/player/pa-srt-cops/translatable-line-wrapper";

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
                'flex justify-between items-start w-full',
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
                                    variant={'ghost'} size={'icon'} className={'p-1'}>
                                    <AiOutlineFieldTime className={cn('w-full h-full fill-black')} />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                点击重置当前句子时间戳
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                )}
            </div>
            <TranslatableLineWrapper sentence={sentence} adjusted={adjusted} clearAdjust={clearAdjust} />
            <div className={cn('w-10 h-full')} />
        </div>
    );
};

export default TranslatableLinePodcast;

TranslatableLinePodcast.defaultProps = {
    className: ''
};
