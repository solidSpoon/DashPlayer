import React, { ReactElement, useCallback, useEffect, useRef, useState } from 'react';
import { shallow } from 'zustand/shallow';

import { PlayerEngine, playerActions } from '@/fronted/components/feature/player/player';
import { usePlayerState } from '@/fronted/hooks/usePlayerState';
import { getRendererLogger } from '@/fronted/log/simple-logger';
import useLayout from '@/fronted/hooks/useLayout';
import PlaybackControlBar from './ControlBar';
import FullscreenSubtitleOverlay from '@/fronted/pages/player/components/subtitles/FullscreenSubtitleOverlay';
import PlaySpeedToaster from '@/fronted/pages/player/components/PlaySpeedToaster';
import PlayerToaster from '@/fronted/pages/player/components/PlayerToaster';
import { cn } from '@/fronted/lib/utils';

const logger = getRendererLogger('PlaybackStage');

type PlaybackStageProps = {
    className?: string;
    onReady?: () => void;
    onEnded?: () => void;
};

export default function PlaybackStage({ className, onReady, onEnded }: PlaybackStageProps): ReactElement {
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

    const playerRefBackground = useRef<HTMLCanvasElement>(null);
    const videoElementRef = useRef<HTMLVideoElement | null>(null);

    const fullScreen = useLayout((s) => s.fullScreen);
    const podcastMode = useLayout((s) => s.podcastMode);

    const [videoReady, setVideoReady] = useState(false);

    // 监听实际源标识：源切换（含同类型源之间）时重置就绪状态，避免旧循环继续抓旧元素
    useEffect(() => {
        videoElementRef.current = null;
        setVideoReady(false);
    }, [src]);

    /**
     * 稳定的 video 元素回调：避免内联回调导致 PlayerEngine 反复清理/重建引用。
     */
    const handleProvideVideoElement = useCallback((video: HTMLVideoElement | null) => {
        videoElementRef.current = video;
    }, []);

    /**
     * 稳定的 ready 回调：标记视频就绪并转发上层回调。
     */
    const handlePlayerReady = useCallback(() => {
        setVideoReady(true);
        onReady?.();
    }, [onReady]);

    /**
     * 稳定的 ended 回调：转发媒体播放结束事件。
     */
    const handlePlayerEnded = useCallback(() => {
        onEnded?.();
    }, [onEnded]);

    useEffect(() => {
        if (!videoReady || podcastMode) {
            return undefined;
        }
        let animationFrameId: number | undefined;
        let cancelled = false;
        let lastDrawTime = Date.now();
        let lastCanvasW = 0;
        let lastCanvasH = 0;
        const fps = 25;
        const drawInterval = 1000 / fps;

        /**
         * 同步抓取视频当前帧绘制到背景 canvas；支持取消与尺寸缓存。
         */
        const syncVideos = async () => {
            if (cancelled) return;
            const now = Date.now();
            if (now - lastDrawTime >= drawInterval) {
                const mainVideo = videoElementRef.current;
                const backgroundCanvas = playerRefBackground.current;
                if (mainVideo && backgroundCanvas && mainVideo.readyState >= 2 && !mainVideo.seeking) {
                    const ctx = backgroundCanvas.getContext('2d');
                    if (ctx) {
                        const { width, height } = backgroundCanvas.getBoundingClientRect();
                        const ratio = window.devicePixelRatio || 1;
                        const resolutionFactor = 0.1;
                        const scaledWidth = width * ratio * resolutionFactor;
                        const scaledHeight = height * ratio * resolutionFactor;

                        // 仅在尺寸变化时重设，避免每帧重分配 canvas backing store
                        if (scaledWidth !== lastCanvasW || scaledHeight !== lastCanvasH) {
                            backgroundCanvas.width = scaledWidth;
                            backgroundCanvas.height = scaledHeight;
                            lastCanvasW = scaledWidth;
                            lastCanvasH = scaledHeight;
                        }

                        ctx.save();
                        ctx.setTransform(1, 0, 0, 1, 0, 0);
                        ctx.clearRect(0, 0, scaledWidth, scaledHeight);
                        let bitmap: ImageBitmap | null = null;
                        try {
                            bitmap = await createImageBitmap(mainVideo);
                            if (!cancelled) {
                                ctx.drawImage(bitmap, 0, 0, scaledWidth, scaledHeight);
                            }
                        } catch (error) {
                            logger.error('failed to draw video frame', { error: error instanceof Error ? error.message : String(error) });
                        } finally {
                            bitmap?.close();
                            ctx.restore();
                        }
                        // 无论成功或失败都更新时间戳，避免失败时每帧高频重试
                        lastDrawTime = now;
                    } else {
                        // 拿不到 2D 上下文：更新时间戳避免每帧高频重试
                        lastDrawTime = now;
                    }
                } else {
                    // 视频未就绪/正在 seek：也推进时间戳，避免无谓高频轮询
                    lastDrawTime = now;
                }
            }
            if (cancelled) return;
            animationFrameId = requestAnimationFrame(syncVideos);
        };

        syncVideos().then();
        return () => {
            cancelled = true;
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
                <PlayerEngine
                    width="100%"
                    height="100%"
                    className="w-full h-full absolute top-0 left-0"
                    onReady={handlePlayerReady}
                    onEnded={handlePlayerEnded}
                    onProvideVideoElement={handleProvideVideoElement}
                />
                {!fullScreen && !podcastMode && (
                    <PlaybackControlBar
                        onTimeChange={(time) => playerActions.seekTo({ time })}
                        className="absolute bottom-0 left-0 z-20"
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
