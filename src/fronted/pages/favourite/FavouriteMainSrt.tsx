import React from 'react';
import useFavouriteClip from '@/fronted/hooks/useFavouriteClip';
const api = window.electron;
const FavouriteMainSrt = () => {
    useFavouriteClip(state => state.currentTime);
    const playInfo = useFavouriteClip(state => state.playInfo);

    const [line] = playInfo?.video?.clip_content?.filter((line) => line.isClip) ?? [];

    if (!line) {
        return <> </>;
    }
    return (
        <div className={'w-full flex flex-col'}>
            <div className="flex justify-center">
                {line.contentEn}
            </div>
            <div className="flex justify-center">
                {line.contentZh}
            </div>
        </div>

    );
};
export default FavouriteMainSrt;
