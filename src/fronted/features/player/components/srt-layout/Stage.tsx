import React, { ReactElement, useCallback, useEffect, useRef, useState } from 'react';
import { shallow } from 'zustand/shallow';

import { playerActions } from '@/fronted/features/player/components/PlayerActions';
import PlayerEngine from '@/fronted/features/player/components/PlayerEngine';
import { usePlayerState } from '@/fronted/features/player/playerState';
import { getRendererLogger } from '@/fronted/log/simple-logger';
import useLayout from '@/fronted/hooks/useLayout';
import PlaybackControlBar from './ControlBar';
import FullscreenSubtitleOverlay from '@/fronted/features/player/components/subtitles/FullscreenSubtitleOverlay';
import PlaySpeedToaster from '@/fronted/features/player/components/PlaySpeedToaster';
import PlayerToaster from '@/fronted/features/player/components/PlayerToaster';
import { cn } from '@/fronted/lib/utils';

const logger = getRendererLogger('PlaybackStage');

type PlaybackStageProps = {
    className?: string;
    onReady?: () => void;
    onEnded?: () => void;
    onProvideVideoElement?: (video: HTMLVideoElement | null) => void;
};

export default function PlaybackStage({ className, onReady, onEnded, onProvideVideoElement }: PlaybackStageProps): ReactElement {
    const {
        playing,
        playbackRate,
        src,
        hasSource
    } = usePlayerState(
        (state) => ({
            playing: state.playing,
            playbackRate: state.playbackRate,
            src: state.src,
            hasSource: !!state.src
        }),
        shallow
    );

    const videoElementRef = useRef<HTMLVideoElement | null>(null);

    const fullScreen = useLayout((s) => s.fullScreen);
    const podcastMode = useLayout((s) => s.podcastMode);

    // 监听实际源标识：源切换（含同类型源之间）时重置就绪状态
    useEffect(() => {
        videoElementRef.current = null;
    }, [src]);

    const handleProvideVideoElement = useCallback((video: HTMLVideoElement | null) => {
        videoElementRef.current = video;
        onProvideVideoElement?.(video);
    }, [onProvideVideoElement]);

    const handlePlayerReady = useCallback(() => {
        onReady?.();
    }, [onReady]);

    const handlePlayerEnded = useCallback(() => {
        onEnded?.();
    }, [onEnded]);

    if (!hasSource) {
        return <div />;
    }

    return (
        <div className={cn('w-full h-full relative bg-transparent transition-colors duration-300', className)}>
            <div className="w-full h-full relative flex items-center justify-center">
                {/* 视频核心播放引擎 */}
                <PlayerEngine
                    width="100%"
                    height="100%"
                    className="w-full h-full absolute top-0 left-0 z-10"
                    onReady={handlePlayerReady}
                    onEnded={handlePlayerEnded}
                    onProvideVideoElement={handleProvideVideoElement}
                />

                {!fullScreen && !podcastMode && (
                    <PlaybackControlBar
                        onTimeChange={(time) => playerActions.seekTo({ time })}
                        className="absolute bottom-2 left-0 z-20"
                        onPause={() => playerActions.pause()}
                        onPlay={() => playerActions.play()}
                        playing={playing}
                    />
                )}
                {fullScreen && <FullscreenSubtitleOverlay />}
                <PlaySpeedToaster speed={playbackRate} className="absolute top-3 left-3" />
                <PlayerToaster className="absolute top-3 left-3" />
            </div>
        </div>
    );
}

PlaybackStage.defaultProps = {
    className: ''
};
