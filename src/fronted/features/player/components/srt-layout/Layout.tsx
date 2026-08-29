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
    const rootContainerRef = useRef<HTMLDivElement>(null);

    // 在根容器底层驱动空间环境光：动态感知视频实际相对位置与比例，实现不规则空间光场投射
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
                const rootContainer = rootContainerRef.current;
                if (videoElement && backgroundCanvas && rootContainer && videoElement.readyState >= 2 && !videoElement.seeking && !videoElement.paused) {
                    const ctx = backgroundCanvas.getContext('2d', { alpha: false });
                    if (ctx) {
                        const rootRect = rootContainer.getBoundingClientRect();
                        const videoRect = videoElement.getBoundingClientRect();

                        const ratio = window.devicePixelRatio || 1;
                        const resolutionFactor = 0.2; // 高性能低分辨率缓冲绘制
                        const scaledRootW = Math.max(1, Math.floor(rootRect.width * ratio * resolutionFactor));
                        const scaledRootH = Math.max(1, Math.floor(rootRect.height * ratio * resolutionFactor));

                        if (scaledRootW !== lastCanvasW || scaledRootH !== lastCanvasH) {
                            backgroundCanvas.width = scaledRootW;
                            backgroundCanvas.height = scaledRootH;
                            lastCanvasW = scaledRootW;
                            lastCanvasH = scaledRootH;
                        }

                        // 动态计算视频在根容器中的真实绝对坐标与尺寸（自动适应普通分栏拖拽与全屏居中）
                        const relX = (videoRect.left - rootRect.left) / rootRect.width;
                        const relY = (videoRect.top - rootRect.top) / rootRect.height;
                        const relW = videoRect.width / rootRect.width;
                        const relH = videoRect.height / rootRect.height;

                        // 柔和向外溢出延伸（Padding Expansion），让光晕自然蔓延渗透到右侧和下方
                        const expandFactor = 0.25; 
                        const drawX = Math.max(0, (relX - relW * expandFactor) * scaledRootW);
                        const drawY = Math.max(0, (relY - relH * expandFactor) * scaledRootH);
                        const drawW = Math.min(scaledRootW, (relW * (1 + expandFactor * 2)) * scaledRootW);
                        const drawH = Math.min(scaledRootH, (relH * (1 + expandFactor * 2)) * scaledRootH);

                        ctx.drawImage(videoElement, drawX, drawY, drawW, drawH);
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
        'relative w-full h-full flex flex-col border-0 border-white/90 drop-shadow-lg overflow-hidden bg-stone-200 dark:bg-black',
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
        <div ref={rootContainerRef} className={containerClass}>
            {/* 顶层全局真实空间环境光 Canvas：覆盖整个播放器窗口 */}
            <canvas
                ref={ambientCanvasRef}
                className={cn(
                    'absolute inset-0 w-full h-full pointer-events-none transition-opacity duration-500 z-0',
                    'blur-[80px] saturate-[1.1] brightness-[0.78]',
                    'dark:blur-[80px] dark:saturate-[1.15] dark:brightness-[0.52]',
                    videoElement ? 'opacity-80 dark:opacity-75' : 'opacity-0',
                    podcastMode && 'hidden'
                )}
            />

            {/* 高性能全局氛围渐变滤镜：压暗背景，提高画质沉浸感与文字可读性 */}
            {!podcastMode && (
                <div
                    className={cn(
                        'absolute inset-0 pointer-events-none transition-colors duration-300 z-0',
                        'bg-gradient-to-b from-black/15 via-black/10 to-black/25',
                        'dark:bg-gradient-to-b dark:from-black/45 dark:via-black/25 dark:to-black/65'
                    )}
                />
            )}

            <ResizablePanelGroup
                className={cn(
                    'relative z-10 bg-transparent'
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
                    <div className="relative w-full h-full overflow-hidden">
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
                                            'group relative h-0 w-full flex items-center justify-center bg-transparent',
                                            'after:hidden data-[panel-group-direction=vertical]:h-0 data-[panel-group-direction=vertical]:after:hidden',
                                            'cursor-row-resize z-20'
                                        )}
                                    >
                                        <div className="absolute -top-2 -bottom-2 inset-x-0 z-10" />
                                        <div className="w-10 h-1 rounded-full bg-stone-500/40 dark:bg-neutral-500/50 group-hover:bg-stone-800 dark:group-hover:bg-neutral-200 group-hover:w-14 transition-all duration-200 shadow-xs z-20 pointer-events-none" />
                                    </ResizableHandle>
                                    <ResizablePanel
                                        className={cn(
                                            'overflow-hidden p-2.5',
                                            'bg-stone-300/60 dark:bg-neutral-950/70 backdrop-blur-2xl'
                                        )}
                                        minSize={0}
                                        defaultSize={sizeIb}
                                        onResize={(e) => {
                                            if (fullScreen) {
                                                return;
                                            }
                                            setSizeIb(e);
                                        }}
                                    >
                                        <div className="w-full h-full rounded-2xl overflow-hidden bg-white/80 dark:bg-neutral-900/80 backdrop-blur-2xl border border-white/60 dark:border-white/10 shadow-[0_4px_24px_-2px_rgba(0,0,0,0.08),0_1px_4px_rgba(0,0,0,0.04)] dark:shadow-[0_4px_24px_-2px_rgba(0,0,0,0.5)]">
                                            <MainSubtitle />
                                        </div>
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
                        <ResizableHandle
                            className={cn(
                                'group relative w-0 h-full flex items-center justify-center bg-transparent',
                                'after:hidden cursor-col-resize z-20'
                            )}
                        >
                            <div className="absolute -left-2 -right-2 inset-y-0 z-10" />
                            <div className="w-1 h-10 rounded-full bg-stone-500/40 dark:bg-neutral-500/50 group-hover:bg-stone-800 dark:group-hover:bg-neutral-200 group-hover:h-14 transition-all duration-200 shadow-xs z-20 pointer-events-none" />
                        </ResizableHandle>
                        <ResizablePanel
                            className="relative overflow-hidden bg-stone-300/60 dark:bg-neutral-950/70 backdrop-blur-2xl"
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
