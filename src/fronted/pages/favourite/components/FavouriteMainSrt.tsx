import React from 'react';
import useFavouriteClip from '@/fronted/hooks/useFavouriteClip';
const FavouriteMainSrt = () => {
    const currentTime = useFavouriteClip(state => state.currentTime);
    const playInfo = useFavouriteClip(state => state.playInfo);
    const srtTender = useFavouriteClip(state => state.srtTender);
    const transMap = useFavouriteClip(state => state.transMap);
    if (!playInfo || !srtTender) {
        return <> </>;
    }
    const line = srtTender.getByTime(currentTime);

    return (
        <div className={'w-full flex flex-col py-2 gap-2 select-text'}>
            <div className="flex justify-center text-2xl text-center">
                {line.contentEn}
            </div>
            <div className="flex justify-center text-center">
                {transMap.get(line.contentEn)}
            </div>
            <div className="flex justify-center text-center">
                {line.contentZh}
            </div>
        </div>

    );
};
export default FavouriteMainSrt;
