import { AspectRatio } from '@/fronted/components/ui/aspect-ratio';
import ReactPlayer from 'react-player';
import UrlUtil from '@/common/utils/UrlUtil';
import React, { useEffect, useState } from 'react';
import useFavouriteClip, { PlayInfo } from '@/fronted/hooks/useFavouriteClip';
import TagSelector from '@/fronted/components/TagSelector';

const FavouritePlayer = () => {
    // const [play, setPlay] = useState(true);
    const setCurrentTime = useFavouriteClip(state => state.setCurrentTime)
    const playInfo = useFavouriteClip(state => state.playInfo);
    const setPlayInfo = useFavouriteClip(state => state.setPlayInfo);
    const playerRef = React.useRef<ReactPlayer>(null);
    const lastSeekTime = React.useRef<PlayInfo>();
    if (lastSeekTime.current !== playInfo) {
        lastSeekTime.current = playInfo;
        setTimeout(() => {
            if (playerRef.current !== null) {
                playerRef.current.seekTo(playInfo?.time);
                // playerRef.current.seekTo(playInfo?.time);
            }
        }, 100);
    }

    useEffect(() => {
        return () => {
            setPlayInfo(null);
        }
    }, [setPlayInfo]);

    return (
        <div className={'w-full flex flex-col'}>
            <AspectRatio ratio={16 / 9}>
                <div className="w-full rounded-lg overflow-hidden">
                    <ReactPlayer
                        ref={playerRef}
                        url={UrlUtil.file(playInfo?.video.clipPath)}
                        width="100%"
                        height="100%"
                        // onMouseEnter={e => e.currentTarget.play()}
                        // onMouseLeave={e => e.currentTarget.pause()}
                        playing={true}
                        onProgress={(state) => {
                            setCurrentTime(state.playedSeconds);
                        }}

                        loop
                    />
                </div>
            </AspectRatio>
            <TagSelector/>
        </div>
    );
}
export default FavouritePlayer;
