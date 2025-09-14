import React, { useState } from 'react';
import { AiOutlineFieldTime } from 'react-icons/ai';
import { Bookmark } from 'lucide-react';
import { cn } from '@/fronted/lib/utils';
import { FONT_SIZE } from '@/fronted/styles/style';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/fronted/components/ui/tooltip';
import { Button } from '@/fronted/components/ui/button';

import { Sentence } from '@/common/types/SentenceC';
import usePlayerController from '@/fronted/hooks/usePlayerController';
import useSetting from '@/fronted/hooks/useSetting';
import useFavouriteClip, { mapClipKey } from '@/fronted/hooks/useFavouriteClip';
import useFile from '@/fronted/hooks/useFile';
import {TranslatableLine} from "@/fronted/components/translable-line";


interface TranslatableLineWrapperProps {
  sentence: Sentence;
  adjusted: boolean;
  clearAdjust: () => void;
  className?: string;     // 可选：容器附加 class
  coreClassName?: string; // 可选：如需给 Core 容器加类，可结合 atoms 改动一起使用
}

const TranslatableLineWrapper: React.FC<TranslatableLineWrapperProps> = ({
  sentence,
  adjusted,
  clearAdjust,
  className,
  coreClassName
}) => {
  const text = sentence.text;
  const fontSize = useSetting((state) => state.values.get('appearance.fontSize'));
  const show = usePlayerController((state) => state.showEn);
  const [hovered, setHovered] = useState(false);

  const isFavourite = useFavouriteClip(
    (s) => s.lineClip.get(mapClipKey(useFile.getState().srtHash, sentence.index)) ?? false
  );

  if (!text) return <div />;

  return (
    <div
      onMouseOver={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        'flex justify-between items-start rounded-lg drop-shadow-md mx-10 mt-2.5 shadow-inner z-50',
        'bg-stone-200 dark:bg-neutral-700',
        'text-stone-700 dark:text-neutral-100',
        'shadow-stone-100 dark:shadow-neutral-600',
        FONT_SIZE['ms1-large'],
        fontSize === 'fontSizeSmall' && FONT_SIZE['ms1-small'],
        fontSize === 'fontSizeMedium' && FONT_SIZE['ms1-medium'],
        fontSize === 'fontSizeLarge' && FONT_SIZE['ms1-large'],
        className
      )}
    >
      {/* 左侧：时间调整（业务控件） */}
      <div className={cn('w-10 m-2.5 h-10 flex-shrink-0')}>
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

      {/* 中间：纯翻译行 */}
      <TranslatableLine
        sentence={sentence}
        show={show || hovered}
        className={coreClassName}
      />

      {/* 右侧：收藏标记（业务控件） */}
      <div className={cn('w-10 h-full flex items-end justify-center pb-2 flex-shrink-0')}>
        {isFavourite && <Bookmark className={cn('w-5 h-5 text-yellow-500 dark:text-yellow-600')} />}
      </div>
    </div>
  );
};

export default TranslatableLineWrapper;
