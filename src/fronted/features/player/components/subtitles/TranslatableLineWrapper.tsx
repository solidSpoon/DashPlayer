import React, { useState } from 'react';
import { History, Bookmark } from 'lucide-react';
import { cn } from '@/fronted/lib/utils';
import { FONT_SIZE } from '@/fronted/styles/style';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/fronted/components/ui/tooltip';
import { Button } from '@/fronted/components/ui/button';

import { Sentence } from '@/common/types/SentenceC';
import { usePlayerUi } from '@/fronted/features/player/playerUiStore';
import useSetting from '@/fronted/features/settings/settingsStore';
import useFavouriteClip, { mapClipKey } from '@/fronted/features/favourite/favouriteStore';
import useFile from '@/fronted/features/file-browser/fileStore';
import TranslatableLine from '@/fronted/features/player/components/translatable-line/translatable-line';


interface TranslatableLineWrapperProps {
  sentence: Sentence;
  adjusted: boolean;
  clearAdjust: () => void;
  className?: string;     // 可选：容器附加 class
  coreClassName?: string; // 可选：如需给 Core 容器加类，可结合 atoms 改动一起使用
  variant?: 'default' | 'plain';
}

const TranslatableLineWrapper: React.FC<TranslatableLineWrapperProps> = ({
  sentence,
  adjusted,
  clearAdjust,
  className,
  coreClassName,
  variant = 'default'
}) => {
  const text = sentence.text;
  const fontSize = useSetting((state) => state.values.get('appearance.fontSize'));
  const show = usePlayerUi((state) => state.showEn);
  const [hovered, setHovered] = useState(false);

  const isFavourite = useFavouriteClip(
    (s) => s.lineClip.get(mapClipKey(useFile.getState().srtHash, sentence.index)) ?? false
  );

  if (!text) return <div />;

  const isHidden = !show && !hovered;

  const variantConfig = variant === 'plain'
    ? {
      root: cn(
        'relative z-10 mx-0 mt-0 rounded-none bg-transparent drop-shadow-none shadow-none text-stone-800 dark:text-neutral-200 pointer-events-auto transition-all duration-200 box-border',
        isHidden && 'opacity-60 hover:opacity-100'
      ),
      actions: 'absolute right-2.5 top-1.5 flex items-center gap-1.5 z-20'
    }
    : {
      root: cn(
        'relative rounded-lg drop-shadow-md mx-10 mt-2.5 shadow-inner z-50 transition-all duration-200 pointer-events-auto box-border',
        isHidden
          ? 'bg-stone-200/80 dark:bg-neutral-800/80 text-stone-500 dark:text-neutral-400 shadow-stone-100/50 dark:shadow-neutral-900/50 hover:bg-stone-200 dark:hover:bg-neutral-700 hover:text-stone-700 dark:hover:text-neutral-200 hover:shadow-stone-100 dark:hover:shadow-neutral-600'
          : 'bg-stone-200 dark:bg-neutral-700 text-stone-700 dark:text-neutral-200 shadow-stone-100 dark:shadow-neutral-600'
      ),
      actions: 'absolute right-3 top-1.5 flex items-center gap-1.5 z-20'
    };

  return (
    <div
      onMouseOver={() => setHovered(true)}
      onFocus={() => setHovered(true)}
      onBlur={() => setHovered(false)}
      onMouseLeave={() => setHovered(false)}
      className={cn(
        'relative flex justify-center items-center font-medium tracking-normal leading-snug',
        variantConfig.root,
        FONT_SIZE['ms1-large'],
        fontSize === 'fontSizeSmall' && FONT_SIZE['ms1-small'],
        fontSize === 'fontSizeMedium' && FONT_SIZE['ms1-medium'],
        fontSize === 'fontSizeLarge' && FONT_SIZE['ms1-large'],
        className
      )}
    >
      {/* 中间纯正文：自然居中 */}
      <div className="w-full">
        <TranslatableLine
          sentence={sentence}
          show={show || hovered}
          className={coreClassName}
        />
      </div>
    </div>
  );
};

export default TranslatableLineWrapper;
