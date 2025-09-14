import React from 'react';
import useFavouriteClip from '@/fronted/hooks/useFavouriteClip';
import { usePlayerV2 } from '@/fronted/hooks/usePlayerV2';

const FavouriteMainSrt = () => {
  const playInfo = useFavouriteClip((state) => state.playInfo);
  const transMap = useFavouriteClip((state) => state.transMap);

  const currentSentence = usePlayerV2((state) => state.currentSentence);

  if (!playInfo || !currentSentence) {
    return <></>;
  }

  return (
    <div className={'w-full flex flex-col py-2 gap-2 select-text'}>
      <div className="flex justify-center text-2xl text-center">{currentSentence.text}</div>
      <div className="flex justify-center text-center">{transMap.get(currentSentence.text)}</div>
      <div className="flex justify-center text-center">{currentSentence.textZH}</div>
    </div>
  );
};
export default FavouriteMainSrt;