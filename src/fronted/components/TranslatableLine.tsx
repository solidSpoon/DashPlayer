import React, { ReactElement, useState } from 'react';
import { AiOutlineFieldTime } from 'react-icons/ai';
import Word from './Word';
import usePlayerController from '../hooks/usePlayerController';
import useSetting from '../hooks/useSetting';
import { cn } from '@/fronted/lib/utils';
import { FONT_SIZE } from '../styles/style';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/fronted/components/ui/tooltip';
import { Button } from '@/fronted/components/ui/button';
import SentenceC from '@/common/types/SentenceC';
import hash from 'object-hash';
import useCopyModeController from '../hooks/useCopyModeController';
import useFavouriteClip, { mapClipKey } from '@/fronted/hooks/useFavouriteClip';
import useFile from '@/fronted/hooks/useFile';
import { Bookmark } from 'lucide-react';

interface TranslatableSubtitleLineParam {
    sentence: SentenceC;
    adjusted: boolean;
    clearAdjust: () => void;
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
const TranslatableLine = ({
                              sentence,
                              adjusted,
                              clearAdjust
                          }: TranslatableSubtitleLineParam) => {
    const text = sentence.text;
    const sentenceStruct = sentence.struct;
    const fontSize = useSetting((state) =>
        state.values.get('appearance.fontSize')
    );
    const show = usePlayerController((state) => state.showEn);
    const [popELe, setPopEle] = useState<string | null>(null);
    const [hovered, setHovered] = useState(false);
    const textHash = hash(text);
    const setCopyContent = useCopyModeController((s) => s.setCopyContent);
    const isCopyMode = useCopyModeController((s) => s.isCopyMode);
    const isFavourite = useFavouriteClip((s) => s.lineClip.get(mapClipKey(useFile.getState().srtHash, sentence.index)) ?? false);
    const handleRequestPop = (k: string) => {
        if (popELe !== k) {
            setPopEle(k);
        }
    };
    const handleLineClick = async (e: React.MouseEvent) => {
        if (isCopyMode) {
            e.stopPropagation();
            setCopyContent(text);
        }
    };
    return text === undefined ? (
        <div />
    ) : (
        <div
            onMouseOver={() => {
                setHovered(true);
            }}
            onMouseLeave={() => {
                setHovered(false);
            }}
            className={cn(
                'flex justify-between items-start rounded-lg drop-shadow-md mx-10 mt-2.5 shadow-inner z-50',
                'bg-stone-200 dark:bg-neutral-700',
                'text-stone-700 dark:text-neutral-100',
                'shadow-stone-100 dark:shadow-neutral-600',
                FONT_SIZE['ms1-large'],
                fontSize === 'fontSizeSmall' && FONT_SIZE['ms1-small'],
                fontSize === 'fontSizeMedium' &&
                FONT_SIZE['ms1-medium'],
                fontSize === 'fontSizeLarge' && FONT_SIZE['ms1-large']
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
            <div
                className={cn(
                    'flex flex-wrap justify-center items-end w-0 flex-1 px-10 pt-2.5 pb-2.5 gap-x-2 gap-y-1'
                )}
                onClick={(e) => handleLineClick(e)}
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
                                            original={part.implicit}
                                            pop={popELe === partId}
                                            requestPop={() =>
                                                handleRequestPop(partId)
                                            }
                                            show={show || hovered}
                                        />
                                    );
                                }
                                return notWord(
                                    part.content,
                                    partId,
                                    show || hovered
                                );
                            })}
                        </div>
                    );
                }) || []}
            </div>
            <div className={cn('w-10 h-full flex items-end justify-center pb-2')}>
                {isFavourite && (
                    <Bookmark  className={cn('w-5 h-5  text-yellow-500 dark:text-yellow-600')} />
                )}
            </div>
        </div>
    );
};

export default TranslatableLine;
