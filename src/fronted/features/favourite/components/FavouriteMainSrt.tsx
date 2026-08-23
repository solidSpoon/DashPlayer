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
    <div className="w-full flex flex-col pt-2 gap-2 select-text">
      {/* 英文可翻译字幕行 */}
      <div className="flex justify-center text-center">
        <TranslatableLine
          sentence={currentSentence}
          show={true}
          className="text-lg sm:text-xl font-medium tracking-tight text-foreground leading-relaxed"
          wordClassNames={{
            hover: 'hover:bg-primary/20 rounded px-0.5 transition-colors',
            vocab: '!text-purple-600 dark:!text-purple-400 !underline !decoration-purple-500 !decoration-1 !bg-purple-500/10 px-1 py-0.5 rounded font-semibold hover:!bg-purple-500/25'
          }}
        />
      </div>

      {/* 显示翻译 */}
      {(transMap.get(currentSentence.text) || currentSentence.textZH) && (
        <div className="flex flex-col gap-1 text-center">
          {transMap.get(currentSentence.text) && (
            <div className="text-sm text-muted-foreground">
              {transMap.get(currentSentence.text)}
            </div>
          )}
          {currentSentence.textZH && (
            <div className="text-sm text-muted-foreground">
              {currentSentence.textZH}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
export default FavouriteMainSrt;
