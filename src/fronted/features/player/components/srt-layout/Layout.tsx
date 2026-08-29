import {cn} from "@/fronted/lib/utils";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/fronted/components/ui/resizable';
import PlaybackStage from './Stage';
import PodcastViewer from '@/fronted/features/player/components/subtitles/PodcastViewer';
import MainSubtitle from './MainSubtitle';
import Subtitle from './components/Subtitle';
import React, { useEffect, useRef, useState } from 'react';
import useFile from '@/fronted/features/file-browser/fileStore';
import useLayout from '@/fronted/hooks/useLayout';
import { useLocalStorage } from '@uidotdev/usehooks';
import StrUtil from '@/common/utils/str-util';
import { getRendererLogger } from '@/fronted/log/simple-logger';
import { usePlayerBridge } from '@/fronted/features/player/hooks/usePlayerBridge';
import { useNavigate } from 'react-router-dom';
import { usePlayerState } from '@/fronted/features/player/playerState';
import PlaybackEmptyState from './EmptyState';

const logger = getRendererLogger('PlaybackLayout');

const PlaybackLayout = () => {
    const hasSubTitle = useFile((s) => StrUtil.isNotBlank(s.subtitlePath));
    const showSideBar = useLayout((state) => state.showSideBar);
    const fullScreen = useLayout((s) => s.fullScreen);
    const podcastMode = useLayout(s => s.podcastMode);
    const hasSource = usePlayerState((s) => !!s.src);
    const [sizeOa, setSizeOa] = useLocalStorage<number>('split-size-oa', 75);
    const [sizeOb, setSizeOb] = useLocalStorage<number>('split-size-ob', 25);
    const [sizeIa, setSizeIa] = useLocalStorage<number>('split-size-ia', 80);
    const [sizeIb, setSizeIb] = useLocalStorage<number>('split-size-ib', 20);
    const navigate = useNavigate();
    const { handlePlayerReady, handleAutoPlayNext } = usePlayerBridge(navigate);

    const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);
    const ambientCanvasRef = useRef<HTMLCanvasElement>(null);

    // 在布局最底层驱动动态环境光，贯通整个上下区域
    useEffect(() => {
        if (!videoElement || podcastMode || !hasSource) {
            return undefined;
        }
        let animationFrameId: number | undefined;
        let cancelled = false;
        let lastDrawTime = 0;
        let lastCanvasW = 0;
        let lastCanvasH = 0;
        const fps = 24;
        const drawInterval = 1000 / fps;

        const syncVideos = () => {
            if (cancelled) return;
            const now = performance.now();
            if (now - lastDrawTime >= drawInterval) {
                const backgroundCanvas = ambientCanvasRef.current;
                if (videoElement && backgroundCanvas && videoElement.readyState >= 2 && !videoElement.seeking && !videoElement.paused) {
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

                        ctx.drawImage(videoElement, 0, 0, scaledWidth, scaledHeight);
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
    }, [videoElement, podcastMode, hasSource]);

    const containerClass = cn(
        'w-full h-full flex flex-col border-0 border-white/90 drop-shadow-lg overflow-hidden',
        hasSubTitle && 'border-r-0',
        showSideBar && 'overflow-hidden border-[30px] border-background/80 rounded-[45px]'
    );

    if (!hasSource) {
        return (
            <div className={containerClass}>
                <PlaybackEmptyState className="w-full" />
            </div>
        );
    }

    return (
        <div className={containerClass}>
            <ResizablePanelGroup
                className={cn(
                    'bg-gray-300 dark:bg-neutral-800'
                )}
                direction={'horizontal'}>
                <ResizablePanel
                    defaultSize={sizeOa}
                    onResize={(e) => {
                        if (fullScreen) {
                            return;
                        }
                        logger.debug('Outer panel resized', { size: e });
                        setSizeOa(e);
                    }}
                >
                    <div className="relative w-full h-full overflow-hidden bg-neutral-200 dark:bg-black">
                        {/* 真正的全左侧通透环境光底层 */}
                        <canvas
                            ref={ambientCanvasRef}
                            className={cn(
                                'absolute inset-0 w-full h-full pointer-events-none transition-opacity duration-500 z-0',
                                'blur-[64px] saturate-[1.4] brightness-105 scale-110',
                                'dark:blur-[64px] dark:saturate-[1.3] dark:brightness-[0.7] dark:scale-110',
                                videoElement ? 'opacity-90 dark:opacity-80' : 'opacity-0',
                                podcastMode && 'hidden'
                            )}
                        />

                        {/* 高性能全局氛围渐变滤镜 */}
                        {!podcastMode && (
                            <div
                                className={cn(
                                    'absolute inset-0 pointer-events-none transition-colors duration-300 z-0',
                                    'bg-gradient-to-b from-white/20 via-transparent to-white/40',
                                    'dark:bg-gradient-to-b dark:from-black/40 dark:via-black/10 dark:to-black/60'
                                )}
                            />
                        )}

                        <ResizablePanelGroup direction={'vertical'} className="relative z-10">
                            <ResizablePanel
                                minSize={10}
                                defaultSize={sizeIa}
                                onResize={(e) => {
                                    if (fullScreen) {
                                        return;
                                    }
                                    setSizeIa(e);
                                }}
                            >
                                <PlaybackStage
                                    className="w-full h-full"
                                    onReady={handlePlayerReady}
                                    onEnded={handleAutoPlayNext}
                                    onProvideVideoElement={setVideoElement}
                                />
                            </ResizablePanel>
                            {!fullScreen && !podcastMode && (
                                <>
                                    <ResizableHandle
                                        className={cn(
                                            'group relative h-2.5 w-full flex items-center justify-center bg-stone-100/70 dark:bg-neutral-900/55 backdrop-blur-xl border-t border-black/10 dark:border-white/10 hover:bg-stone-200/80 dark:hover:bg-neutral-800/70 transition-colors cursor-row-resize'
                                        )}
                                    >
                                        <div className="w-12 h-1 rounded-full bg-stone-400/70 dark:bg-neutral-400/70 group-hover:bg-stone-700 dark:group-hover:bg-neutral-200 group-hover:w-16 transition-all duration-200" />
                                    </ResizableHandle>
                                    <ResizablePanel
                                        className={cn('overflow-hidden bg-stone-50/75 dark:bg-neutral-900/62 backdrop-blur-2xl')}
                                        minSize={0}
                                        defaultSize={sizeIb}
                                        onResize={(e) => {
                                            if (fullScreen) {
                                                return;
                                            }
                                            setSizeIb(e);
                                        }}
                                    >
                                        <MainSubtitle />
                                    </ResizablePanel>
                                </>
                            )}

                        </ResizablePanelGroup>

                        {/* 播客模式：作为顶层全屏覆盖层呈现，保留底部的 PlaybackStage 与 Panel 结构完整稳定 */}
                        {podcastMode && (
                            <PodcastViewer className="absolute inset-0 z-30" />
                        )}
                    </div>
                </ResizablePanel>

                {!fullScreen && (
                    <>
                        <ResizableHandle withHandle className={cn('gutter-style w-2 dark:bg-zinc-700')} />
                        <ResizablePanel
                            defaultSize={sizeOb}
                            onResize={(e) => {
                                if (fullScreen) {
                                    return;
                                }
                                setSizeOb(e);
                            }}
                        >
                            <Subtitle />
                        </ResizablePanel>
                    </>)}
            </ResizablePanelGroup>
        </div>
    )
}

export default PlaybackLayout;
