import React from 'react';
import useFavouriteClip from '@/fronted/hooks/useFavouriteClip';
import { usePlayerV2 } from '@/fronted/hooks/usePlayerV2';
import { TranslatableLine } from '@/fronted/components/feature/player/translatable-line';

const FavouriteMainSrt = () => {
  const playInfo = useFavouriteClip((state) => state.playInfo);
  const transMap = useFavouriteClip((state) => state.transMap);

  const currentSentence = usePlayerV2((state) => state.currentSentence);

  console.log('FavouriteMainSrt render:', {
    sentenceKey: currentSentence ? `${currentSentence.fileHash}-${currentSentence.index}` : null,
    timestamp: Date.now()
  });

  if (!playInfo || !currentSentence) {
    return <></>;
  }

  return (
    <div className="w-full flex flex-col py-2 gap-2 select-text">
      {/* 英文可翻译字幕行 */}
      <TranslatableLine
        sentence={currentSentence}
        show={true}
        className="flex justify-center text-2xl text-center"
        wordClassNames={{
          hover: 'hover:bg-blue-100 dark:hover:bg-blue-900/30',
          vocab: '!text-purple-500 !underline !decoration-purple-500 !decoration-1 !bg-purple-500/10 px-0.5 rounded hover:!bg-purple-500/30'
        }}
      />

      {/* 显示翻译 */}
      {(transMap.get(currentSentence.text) || currentSentence.textZH) && (
        <div className="flex flex-col gap-2">
          {transMap.get(currentSentence.text) && (
            <div className="flex justify-center text-center text-gray-600 dark:text-gray-400">
              {transMap.get(currentSentence.text)}
            </div>
          )}
          {currentSentence.textZH && (
            <div className="flex justify-center text-center text-gray-600 dark:text-gray-400">
              {currentSentence.textZH}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
export default FavouriteMainSrt;
