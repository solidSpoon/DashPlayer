import React, { useState } from 'react';
import { AiOutlineFieldTime } from 'react-icons/ai';
import usePlayerController from '../../hooks/usePlayerController';
import useSetting from '../../hooks/useSetting';
import { cn } from '@/fronted/lib/utils';
import { FONT_SIZE } from '../../styles/style';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/fronted/components/ui/tooltip';
import { Button } from '@/fronted/components/ui/button';
import { Sentence } from '@/common/types/SentenceC';
import useFavouriteClip, { mapClipKey } from '@/fronted/hooks/useFavouriteClip';
import useFile from '@/fronted/hooks/useFile';
import { Bookmark } from 'lucide-react';
import TranslatableLineCore from '@/fronted/components/srt-cops/atoms/TranslatableLineCore';

interface TranslatableSubtitleLineParam {
    sentence: Sentence;
    adjusted: boolean;
    clearAdjust: () => void;
}

const TranslatableLine = ({
                              sentence,
                              adjusted,
                              clearAdjust
                          }: TranslatableSubtitleLineParam) => {
    const text = sentence.text;
    const fontSize = useSetting((state) =>
        state.values.get('appearance.fontSize')
    );
    const show = usePlayerController((state) => state.showEn);
    const [hovered, setHovered] = useState(false);
    const isFavourite = useFavouriteClip((s) => s.lineClip.get(mapClipKey(useFile.getState().srtHash, sentence.index)) ?? false);
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
            <TranslatableLineCore sentence={sentence} show={show || hovered} />
            <div className={cn('w-10 h-full flex items-end justify-center pb-2')}>
                {isFavourite && (
                    <Bookmark className={cn('w-5 h-5  text-yellow-500 dark:text-yellow-600')} />
                )}
            </div>
        </div>
    );
};

export default TranslatableLine;
