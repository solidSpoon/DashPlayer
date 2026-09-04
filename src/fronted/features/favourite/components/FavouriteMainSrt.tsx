import React from 'react';
import useFavouriteClip from '@/fronted/features/favourite/favouriteStore';
import { usePlayer } from '@/fronted/features/player/playerStore';
import TranslatableLine from '@/fronted/features/player/components/translatable-line/translatable-line';

const FavouriteMainSrt = () => {
  const playInfo = useFavouriteClip((state) => state.playInfo);
  const transMap = useFavouriteClip((state) => state.transMap);

  const currentSentence = usePlayer((state) => state.currentSentence);

  if (!playInfo || !currentSentence) {
    return <></>;
  }

  return (
    <div className="w-full flex flex-col pt-2 gap-2 select-text min-w-0">
      {/* 英文可翻译字幕行 */}
      <div className="w-full flex justify-center text-center min-w-0">
        <TranslatableLine
          sentence={currentSentence}
          show={true}
          className="w-full max-w-full text-base sm:text-lg md:text-xl font-medium tracking-tight text-foreground leading-relaxed break-words whitespace-normal px-2 text-center"
          wordClassNames={{
            hover: 'hover:bg-primary/20 rounded px-0.5 transition-colors',
            vocab: 'text-purple-700 dark:text-purple-400 font-medium underline decoration-purple-500/50 dark:decoration-purple-400/40 decoration-[1.5px] underline-offset-[0.22em] rounded px-0.5 transition-colors duration-150 hover:bg-purple-500/10 dark:hover:bg-purple-400/10 hover:decoration-purple-600 dark:hover:decoration-purple-300'
          }}
        />
      </div>

      {/* 显示翻译 */}
      {(transMap.get(currentSentence.text) || currentSentence.textZH) && (
        <div className="w-full flex flex-col gap-1 text-center min-w-0 px-2">
          {transMap.get(currentSentence.text) && (
            <div className="text-sm text-muted-foreground leading-normal break-words whitespace-normal">
              {transMap.get(currentSentence.text)}
            </div>
          )}
          {currentSentence.textZH && (
            <div className="text-sm text-muted-foreground leading-normal break-words whitespace-normal">
              {currentSentence.textZH}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
export default FavouriteMainSrt;
