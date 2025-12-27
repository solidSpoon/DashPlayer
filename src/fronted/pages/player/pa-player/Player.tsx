import React, { ReactElement, useEffect, useRef, useState } from 'react';
import { shallow } from 'zustand/shallow';

import { PlayerEngineV2, playerV2Actions } from '@/fronted/components/feature/player/player-v2';
import { usePlayerV2State } from '@/fronted/hooks/usePlayerV2State';
import { getRendererLogger } from '@/fronted/log/simple-logger';
import useLayout from '@/fronted/hooks/useLayout';
import PlayerControlPanel from './PlayerControlPanel';
import PlayerSubtitlePanel from '@/fronted/pages/player/playerSubtitle/PlayerSubtitlePanel';
import PlaySpeedToaster from '@/fronted/pages/player/components/PlaySpeedToaster';
import PlayerToaster from '@/fronted/pages/player/components/PlayerToaster';
import { cn } from '@/fronted/lib/utils';

const logger = getRendererLogger('Player');

type PlayerProps = {
    className?: string;
    onReady?: () => void;
    onEnded?: () => void;
};

export default function Player({ className, onReady, onEnded }: PlayerProps): ReactElement {
    const {
        playing,
        playbackRate,
        hasSource
    } = usePlayerV2State(
        (state) => ({
            playing: state.playing,
            playbackRate: state.playbackRate,
            hasSource: !!state.src
        }),
        shallow
    );

    const playerRefBackground = useRef<HTMLCanvasElement>(null);
    const videoElementRef = useRef<HTMLVideoElement | null>(null);

    const fullScreen = useLayout((s) => s.fullScreen);
    const podcastMode = useLayout((s) => s.podcastMode);

    const [videoReady, setVideoReady] = useState(false);

    useEffect(() => {
        setVideoReady(false);
    }, [hasSource]);

    useEffect(() => {
        if (!videoReady || podcastMode) {
            return undefined;
        }
        let animationFrameId: number | undefined;
        let lastDrawTime = Date.now();
        const fps = 25;
        const drawInterval = 1000 / fps;

        const syncVideos = async () => {
            const now = Date.now();
            if (now - lastDrawTime >= drawInterval) {
                const mainVideo = videoElementRef.current;
                const backgroundCanvas = playerRefBackground.current;
                if (mainVideo && backgroundCanvas && mainVideo.readyState >= 2) {
                    const ctx = backgroundCanvas.getContext('2d');
                    if (ctx) {
                        const { width, height } = backgroundCanvas.getBoundingClientRect();
                        const ratio = window.devicePixelRatio || 1;
                        const resolutionFactor = 0.1;
                        const scaledWidth = width * ratio * resolutionFactor;
                        const scaledHeight = height * ratio * resolutionFactor;

                        backgroundCanvas.width = scaledWidth;
                        backgroundCanvas.height = scaledHeight;

                        ctx.save();
                        ctx.setTransform(1, 0, 0, 1, 0, 0);
                        ctx.clearRect(0, 0, scaledWidth, scaledHeight);
                        try {
                            const bitmap = await createImageBitmap(mainVideo);
                            ctx.drawImage(bitmap, 0, 0, scaledWidth, scaledHeight);
                            bitmap.close();
                        } catch (error) {
                            logger.error('failed to draw video frame', { error: error instanceof Error ? error.message : String(error) });
                        }
                        ctx.restore();

                        lastDrawTime = now;
                    }
                }
            }
            animationFrameId = requestAnimationFrame(syncVideos);
        };

        syncVideos().then();
        return () => {
            if (animationFrameId) {
                cancelAnimationFrame(animationFrameId);
            }
        };
    }, [videoReady, podcastMode]);

    if (!hasSource) {
        return <div />;
    }

    return (
        <div className={cn('w-full h-full overflow-hidden', className)}>
            <div className="w-full h-full relative overflow-hidden">
                <canvas
                    className="w-full h-full"
                    ref={playerRefBackground}
                    style={{
                        filter: 'blur(100px)',
                        objectFit: 'cover'
                    }}
                />
                <PlayerEngineV2
                    width="100%"
                    height="100%"
                    className="w-full h-full absolute top-0 left-0"
                    onReady={() => {
                        setVideoReady(true);
                        onReady?.();
                    }}
                    onEnded={() => {
                        onEnded?.();
                    }}
                    onProvideVideoElement={(video) => {
                        videoElementRef.current = video;
                    }}
                />
                {!fullScreen && !podcastMode && (
                    <PlayerControlPanel
                        onTimeChange={(time) => playerV2Actions.seekTo({ time })}
                        className="absolute bottom-0 left-0 z-20"
                        onPause={() => playerV2Actions.pause()}
                        onPlay={() => playerV2Actions.play()}
                        playing={playing}
                    />
                )}
                {fullScreen && <PlayerSubtitlePanel />}
                <PlaySpeedToaster speed={playbackRate} className="absolute top-3 left-3" />
                <PlayerToaster className="absolute top-3 left-3" />
            </div>
        </div>
    );
}

Player.defaultProps = {
    className: ''
};
