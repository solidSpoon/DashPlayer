import React from 'react';
import { AiOutlineFieldTime } from 'react-icons/ai';
import useSetting from '@/fronted/hooks/useSetting';
import usePlayerUi from '@/fronted/hooks/usePlayerUi';
import { p } from '@/common/utils/Util';
import { FONT_SIZE } from '@/fronted/styles/style';
import { cn } from '@/fronted/lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/fronted/components/ui/tooltip';
import { Button } from '@/fronted/components/ui/button';
import { Sentence } from '@/common/types/SentenceC';
import { Bookmark } from 'lucide-react';
import useFavouriteClip, { mapClipKey } from '@/fronted/hooks/useFavouriteClip';
import useFile from '@/fronted/hooks/useFile';
import TranslatableLineWrapper from './translatable-line-wrapper';

interface PlayerTranslatableSubtitleLineParam {
    sentence: Sentence;
    adjusted: boolean;
    clearAdjust: () => void;
}

const FullscreenTranslatableLine = ({
                                        sentence,
                                        adjusted,
                                        clearAdjust
                                    }: PlayerTranslatableSubtitleLineParam) => {
    const fontSize = useSetting((state) =>
        state.values.get('appearance.fontSize')
    );
    const show = usePlayerUi((state) => state.showEn);
    const text = sentence.text;
    const isFavourite = useFavouriteClip((s) => s.lineClip.get(mapClipKey(useFile.getState().srtHash, sentence.index)) ?? false);

    return (!p(text) || !show) ? (
        <div />
    ) : (
        <div
            className={cn(
                'flex justify-center items-center',
                // 'bg-background/50 text-foreground',
                FONT_SIZE['ms1-large'],
                fontSize === 'fontSizeSmall' && FONT_SIZE['ms1-small'],
                fontSize === 'fontSizeMedium' &&
                FONT_SIZE['ms1-medium'],
                fontSize === 'fontSizeLarge' && FONT_SIZE['ms1-large']
            )}
        >
            <div
                className={cn(
                    'flex justify-center items-end px-2.5 gap-x-2 gap-y-1 bg-black/50 text-white rounded'
                )}
            >
                {adjusted && (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button
                                    onClick={clearAdjust}
                                    variant={'ghost'} size={'icon'} className={'w-8 h-8 mb-2.5 flex-shrink-0'}>
                                    <AiOutlineFieldTime className={cn('fill-gray-300')} />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>
                                点击重置当前句子时间戳
                            </TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                )}
                <TranslatableLineWrapper sentence={sentence} adjusted={adjusted} clearAdjust={clearAdjust} />

                {adjusted && (
                    <div className={cn('w-10 h-full flex-shrink-0 py-2.5')}>
                        {isFavourite && (
                            <Bookmark className={cn('w-5 h-5 text-white ml-auto')} />
                        )}
                    </div>
                )}
            </div>

        </div>
    );
};

export default FullscreenTranslatableLine;
