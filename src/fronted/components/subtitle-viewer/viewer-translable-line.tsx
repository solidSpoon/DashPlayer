import React, {ReactElement, useState} from 'react';
import {AiOutlineFieldTime} from 'react-icons/ai';
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from '@/fronted/components/ui/tooltip';
import {Button} from '@/fronted/components/ui/button';
import {cn} from "@/fronted/lib/utils";
import Word from "@/fronted/components/Word";
import SentenceC from "@/common/types/SentenceC";
import hash from "object-hash";

interface TranslatableSubtitleLineParam {
    sentence: SentenceC;
    adjusted: boolean;
    clearAdjust: () => void;
    className?: string;
}

const notWord = (str: string, key: string, showE: boolean): ReactElement => {
    return (
        <div
            className={`select-none ${showE ? '' : 'text-transparent'}`}
            key={key}
        >
            {str}
        </div>
    );
};
const ViewerTranslableLine = ({
                                  sentence,
                                  adjusted,
                                  clearAdjust,
                                  className
                              }: TranslatableSubtitleLineParam) => {
    const [popELe, setPopEle] = useState<string | null>(null);

    const text = sentence.text;
    const sentenceStruct = sentence.struct;
    const textHash = hash(text);
    const handleRequestPop = (k: string) => {
        if (popELe !== k) {
            setPopEle(k);
        }
    };

    return text === undefined ? (
        <div/>
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
                                    <AiOutlineFieldTime className={cn('w-full h-full fill-black')}/>
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                点击重置当前句子时间戳
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                )}
            </div>
            <div
                className={cn(
                    'flex flex-wrap justify-center items-end w-0 flex-1 px-10 pt-2.5 pb-2.5 gap-x-2 gap-y-1'
                )}
            >
                {sentenceStruct?.blocks.map((block, blockIndex) => {
                    return (
                        <div className={cn('flex items-end')}>
                            {block.blockParts.map((part, partIndex) => {
                                const partId = `${textHash}:${blockIndex}:${partIndex}`;
                                if (part.isWord) {
                                    return (
                                        <Word
                                            original={part.implicit}
                                            key={partId}
                                            word={part.content}
                                            pop={popELe === partId}
                                            requestPop={() =>
                                                handleRequestPop(partId)
                                            }
                                            show
                                        />
                                    );
                                }
                                return notWord(
                                    part.content,
                                    partId,
                                    true
                                );
                            })}
                        </div>
                    );
                }) || []}
            </div>
            <div className={cn('w-10 h-full')}/>
        </div>
    );
};

export default ViewerTranslableLine;

ViewerTranslableLine.defaultProps = {
    className: ''
}
