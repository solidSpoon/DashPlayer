import React, {ReactElement, useState} from 'react';
import {AiOutlineFieldTime} from 'react-icons/ai';
import {Tooltip, TooltipContent, TooltipProvider, TooltipTrigger} from '@/fronted/components/ui/tooltip';
import {Button} from '@/fronted/components/ui/button';
import useSetting from "@/fronted/hooks/useSetting";
import usePlayerController from "@/fronted/hooks/usePlayerController";
import {cn, p} from "@/common/utils/Util";
import hash from "@/common/utils/hash";
import {FONT_SIZE} from "@/fronted/styles/style";
import Word from "@/fronted/components/Word";

interface TranslatableSubtitleLineParam {
    text: string;
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
                                  text,
                                  adjusted,
                                  clearAdjust,
                                  className
                              }: TranslatableSubtitleLineParam) => {
    const sentenceStruct = usePlayerController((state) =>
        state.subTitlesStructure.get(p(text))
    );
    const [popELe, setPopEle] = useState<string | null>(null);
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
                'text-stone-700 dark:text-neutral-100',
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
