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
import TranslatableLineCore from '@/fronted/components/translable-line/translatable-line-core';
import { TransLineThemeProvider, DeepPartial, TransLineTheme, useTransLineTheme } from '@/fronted/components/translable-line/translatable-theme';

interface TranslatableSubtitleLineParam {
    sentence: Sentence;
    adjusted: boolean;
    clearAdjust: () => void;
    themeOverride?: DeepPartial<TransLineTheme>; // 新增：主题覆盖
    classNames?: {
        container?: string; // 外层容器 className
        core?: string;      // 传给 Core 的 root class
    };
}

const Inner = ({
  sentence,
  adjusted,
  clearAdjust,
  classNames
}: Omit<TranslatableSubtitleLineParam, 'themeOverride'>) => {
    const theme = useTransLineTheme();
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
                theme.container,
                FONT_SIZE['ms1-large'],
                fontSize === 'fontSizeSmall' && FONT_SIZE['ms1-small'],
                fontSize === 'fontSizeMedium' && FONT_SIZE['ms1-medium'],
                fontSize === 'fontSizeLarge' && FONT_SIZE['ms1-large'],
                classNames?.container
            )}
        >
            <div className={cn(theme.leftIcon)}>
                {adjusted && (
                    <TooltipProvider>
                        <Tooltip>
                            <TooltipTrigger asChild>
                                <Button onClick={clearAdjust} variant={'ghost'} size={'icon'} className={cn('[&_svg]:size-7')}>
                                    <AiOutlineFieldTime className={cn('fill-black')} />
                                </Button>
                            </TooltipTrigger>
                            <TooltipContent>点击重置当前句子时间戳</TooltipContent>
                        </Tooltip>
                    </TooltipProvider>
                )}
            </div>

            <TranslatableLineCore
                sentence={sentence}
                show={show || hovered}
                className={classNames?.core}
            />

            <div className={cn(theme.rightIcon)}>
                {isFavourite && <Bookmark className={cn('w-5 h-5 text-yellow-500 dark:text-yellow-600')} />}
            </div>
        </div>
    );
};

const TranslatableLine = (props: TranslatableSubtitleLineParam) => {
    const { themeOverride, ...rest } = props;
    return (
        <TransLineThemeProvider value={themeOverride}>
            <Inner {...rest} />
        </TransLineThemeProvider>
    );
};

export default TranslatableLine;
