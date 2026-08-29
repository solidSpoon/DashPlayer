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
        window.setTimeout(() => setVideoReady(false), 0);
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
        let lastDrawTime = 0;
        let lastCanvasW = 0;
        let lastCanvasH = 0;
        // 采样帧率：24fps（与大部分影视帧率一致，完全匹配视频本身的流畅度）
        const fps = 24;
        const drawInterval = 1000 / fps;

        /**
         * 极速同步抓取视频帧：
         * 1. 放弃 createImageBitmap 异步 Promise，直接使用浏览器 GPU 加速的 ctx.drawImage(HTMLVideoElement)，零异步/GC开销；
         * 2. 移除 DOM 上的 backdrop-filter，避免 GPU 逐帧回读合成瓶颈。
         */
        const syncVideos = () => {
            if (cancelled) return;
            const now = performance.now();
            if (now - lastDrawTime >= drawInterval) {
                const mainVideo = videoElementRef.current;
                const backgroundCanvas = playerRefBackground.current;
                if (mainVideo && backgroundCanvas && mainVideo.readyState >= 2 && !mainVideo.seeking && !mainVideo.paused) {
                    const ctx = backgroundCanvas.getContext('2d', { alpha: false });
                    if (ctx) {
                        const { width, height } = backgroundCanvas.getBoundingClientRect();
                        const ratio = window.devicePixelRatio || 1;
                        const resolutionFactor = 0.2;
                        const scaledWidth = Math.max(1, Math.floor(width * ratio * resolutionFactor));
                        const scaledHeight = Math.max(1, Math.floor(height * ratio * resolutionFactor));

                        if (scaledWidth !== lastCanvasW || scaledHeight !== lastCanvasH) {
                            backgroundCanvas.width = scaledWidth;
                            backgroundCanvas.height = scaledHeight;
                            lastCanvasW = scaledWidth;
                            lastCanvasH = scaledHeight;
                        }

                        ctx.drawImage(mainVideo, 0, 0, scaledWidth, scaledHeight);
                    }
                }
                lastDrawTime = now;
            }
            if (cancelled) return;
            animationFrameId = requestAnimationFrame(syncVideos);
        };

        animationFrameId = requestAnimationFrame(syncVideos);
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
        <div className={cn('w-full h-full overflow-hidden bg-neutral-200 dark:bg-black transition-colors duration-300', className)}>
            <div className="w-full h-full relative overflow-hidden flex items-center justify-center">
                {/* 动态环境光 Canvas：
                    - 硬件加速模糊与缩放（适度提高虚化至 48px~52px，保留光影流动感但消除具象细节）
                    - 亮色模式：提亮 + 自然白底融合
                    - 暗色模式：适度压暗 + 深黑底融合
                */}
                <canvas
                    className={cn(
                        'absolute inset-0 w-full h-full pointer-events-none transition-opacity duration-300 ease-out',
                        'blur-[48px] saturate-[1.25] brightness-105',
                        'dark:blur-[52px] dark:saturate-[1.2] dark:brightness-[0.75]',
                        'opacity-0',
                        videoReady && !podcastMode && 'opacity-90 dark:opacity-85',
                        podcastMode && 'hidden'
                    )}
                    ref={playerRefBackground}
                    style={{
                        transform: 'scale(1.22) translate3d(0, 0, 0)',
                        willChange: 'transform'
                    }}
                />

                {/* 高性能主题遮罩层（使用纯 CSS 渐变，不使用 backdrop-filter 以免消耗 GPU） */}
                {!podcastMode && (
                    <div
                        className={cn(
                            'absolute inset-0 pointer-events-none transition-colors duration-300',
                            'bg-gradient-to-b from-white/25 via-transparent to-white/35',
                            'dark:bg-gradient-to-b dark:from-black/50 dark:via-black/20 dark:to-black/65'
                        )}
                    />
                )}

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
