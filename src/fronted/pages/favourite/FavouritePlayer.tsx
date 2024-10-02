import { AspectRatio } from '@/fronted/components/ui/aspect-ratio';
import ReactPlayer from 'react-player';
import UrlUtil from '@/common/utils/UrlUtil';
import React, { useEffect } from 'react';
import useFavouriteClip, { PlayInfo } from '@/fronted/hooks/useFavouriteClip';
import TagSelector from '@/fronted/components/TagSelector';
import FavouriteMainSrt from '@/fronted/pages/favourite/FavouriteMainSrt';
import { useHotkeys } from 'react-hotkeys-hook';

const FavouritePlayer = () => {

    const setCurrentTime = useFavouriteClip(state => state.setCurrentTime);
    const playInfo = useFavouriteClip(state => state.playInfo);
    const setPlayInfo = useFavouriteClip(state => state.setPlayInfo);
    const playerRef = React.useRef<ReactPlayer>(null);
    const lastSeekTime = React.useRef<PlayInfo>();
    if (lastSeekTime.current !== playInfo && playInfo) {
        lastSeekTime.current = playInfo;
        setTimeout(() => {
            if (playerRef.current !== null) {
                playerRef.current.seekTo(playInfo?.time);
            }
        }, 100);
    }
    useHotkeys('space', (e) => {
        e.preventDefault();
        const current = playerRef.current;
        if (current) {
            const internalPlayer = current.getInternalPlayer() as HTMLVideoElement;
            internalPlayer.paused ? internalPlayer.play() : internalPlayer.pause();
        }
    });
    useEffect(() => {
        return () => {
            setPlayInfo(null);
        };
    }, [setPlayInfo]);

    return (
        <div className={'w-full flex flex-col gap-4'}>
            {playInfo && <>
                <AspectRatio ratio={16 / 9}>
                    <div className="w-full rounded-lg overflow-hidden">
                        <ReactPlayer
                            ref={playerRef}
                            url={UrlUtil.file(playInfo?.video.baseDir, playInfo?.video.clip_file)}
                            width="100%"
                            height="100%"
                            controls={true}
                            // onMouseEnter={e => e.currentTarget.play()}
                            // onMouseLeave={e => e.currentTarget.pause()}
                            playing={true}
                            onProgress={(state) => {
                                setCurrentTime(state.playedSeconds);
                            }}
                            onStart={async () => {
                                //jump
                                if (playInfo?.time) {
                                    playerRef.current?.seekTo(playInfo?.time);
                                }
                            }}

                            loop
                        />
                    </div>
                </AspectRatio>
                <TagSelector />
                <FavouriteMainSrt />
            </>}
        </div>
    );
};
export default FavouritePlayer;
