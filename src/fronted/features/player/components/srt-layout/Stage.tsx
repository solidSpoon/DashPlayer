import React, { ReactElement, useCallback, useEffect, useRef, useState } from 'react';
import { shallow } from 'zustand/shallow';

import { playerActions } from '@/fronted/features/player/components/PlayerActions';
import PlayerEngine from '@/fronted/features/player/components/PlayerEngine';
import { usePlayerState } from '@/fronted/features/player/playerState';
import useLayout from '@/fronted/hooks/useLayout';
import PlaybackControlBar from './ControlBar';
import HardsubMask from '@/fronted/features/player/components/HardsubMask';
import FullscreenSubtitleOverlay from '@/fronted/features/player/components/subtitles/FullscreenSubtitleOverlay';
import DubbingStageController from '@/fronted/features/player/dubbing/components/DubbingStageController';
import { cn } from '@/fronted/lib/utils';

type PlaybackStageProps = {
    className?: string;
    onReady?: () => void;
    onEnded?: () => void;
    onProvideVideoElement?: (video: HTMLVideoElement | null) => void;
};

export default function PlaybackStage({ className, onReady, onEnded, onProvideVideoElement }: PlaybackStageProps): ReactElement {
    const {
        src,
        hasSource
    } = usePlayerState(
        (state) => ({
            src: state.src,
            hasSource: !!state.src
        }),
        shallow
    );

    const videoElementRef = useRef<HTMLVideoElement | null>(null);
    // 视频元素本身（不只是 ref）也要交给遮挡带：它要读 videoWidth / videoHeight 对齐真实画面
    const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);

    const fullScreen = useLayout((s) => s.fullScreen);
    const podcastMode = useLayout((s) => s.podcastMode);

    // 监听实际源标识：源切换（含同类型源之间）时重置就绪状态
    useEffect(() => {
        videoElementRef.current = null;
    }, [src]);

    const handleProvideVideoElement = useCallback((video: HTMLVideoElement | null) => {
        videoElementRef.current = video;
        setVideoElement(video);
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
                    className="w-full h-full absolute top-0 left-0"
                    onReady={handlePlayerReady}
                    onEnded={handlePlayerEnded}
                    onProvideVideoElement={handleProvideVideoElement}
                />

                {/* 硬字幕遮挡：只盖画面，不进入视频层的点击链路 */}
                {!podcastMode && <HardsubMask video={videoElement} />}

                {!fullScreen && !podcastMode && (
                    <PlaybackControlBar
                        onTimeChange={(time) => playerActions.seekTo({ time })}
                        className="absolute left-0"
                    />
                )}
                {fullScreen && <FullscreenSubtitleOverlay />}

                {/* 配音控制器：快捷键监听与配音清单加载，无 UI */}
                <DubbingStageController />
            </div>
        </div>
    );
}

PlaybackStage.defaultProps = {
    className: ''
};
