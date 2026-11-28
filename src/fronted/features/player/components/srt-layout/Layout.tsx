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
import LearningPage from '@/fronted/features/chat/LearningPage';
import useChatPanel from '@/fronted/features/chat/chatStore';
import LearningModeButton from './LearningModeButton';
import { CAPTION_CARD_ANCHOR_CLASS, CAPTION_CARD_CLASS } from '@/fronted/features/player/components/captionCardShell';

const logger = getRendererLogger('PlaybackLayout');

/** 环境光采样帧率：低频更新光晕色彩即可保证平滑过渡，同时避免高分屏抢占视频解码纹理带宽。 */
const AMBIENT_FPS = 10;
/** 环境光画布最大宽度（像素）：在极小离屏分辨率上做模糊，替代全屏大半径 CSS 高斯模糊。 */
const AMBIENT_MAX_WIDTH = 96;
/** 在低分辨率画布内部应用的模糊半径（像素），放大铺满窗口后等效大半径柔光。 */
const AMBIENT_CANVAS_BLUR_PX = 5;

/** 缓存的矩形几何信息，避免在绘制帧内重复触发布局测量。 */
interface AmbientGeometry {
    rootLeft: number;
    rootTop: number;
    rootWidth: number;
    rootHeight: number;
    videoLeft: number;
    videoTop: number;
    videoWidth: number;
    videoHeight: number;
}

const PlaybackLayout = () => {
    const hasSubTitle = useFile((s) => StrUtil.isNotBlank(s.subtitlePath));
    const showSideBar = useLayout((state) => state.showSideBar);
    const fullScreen = useLayout((s) => s.fullScreen);
    const podcastMode = useLayout(s => s.podcastMode);
    const hasSource = usePlayerState((s) => !!s.src);
    const hasLearningContext = useChatPanel((s) => s.hasLearningContext);
    const learningVisible = useChatPanel((s) => s.learningVisible);
    // 有会话时保持挂载，切回播放画面只做隐藏，避免回来时对话与滚动状态丢失
    const learningMounted = learningVisible || hasLearningContext;
    const [sizeOa, setSizeOa] = useLocalStorage<number>('split-size-oa', 75);
    const [sizeOb, setSizeOb] = useLocalStorage<number>('split-size-ob', 25);
    const [sizeIa, setSizeIa] = useLocalStorage<number>('split-size-ia', 80);
    const [sizeIb, setSizeIb] = useLocalStorage<number>('split-size-ib', 20);
    const navigate = useNavigate();
    const { handlePlayerReady, handleAutoPlayNext } = usePlayerBridge(navigate);

    const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(null);
    const ambientCanvasRef = useRef<HTMLCanvasElement>(null);
    const rootContainerRef = useRef<HTMLDivElement>(null);

    // 在根容器底层驱动空间环境光：低分辨率离屏绘制与模糊，缓存几何尺寸避免帧内回流与 4K 全屏合成卡顿
    useEffect(() => {
        if (!videoElement || podcastMode || !hasSource) {
            return undefined;
        }
        let animationFrameId: number | undefined;
        let cancelled = false;
        let lastDrawTime = 0;
        let lastCanvasW = 0;
        let lastCanvasH = 0;
        const drawInterval = 1000 / AMBIENT_FPS;
        let geometry: AmbientGeometry | null = null;

        /**
         * 同步根容器与视频元素的布局矩形，仅在尺寸变化时调用一次测量。
         */
        const measureGeometry = () => {
            const rootContainer = rootContainerRef.current;
            if (!rootContainer || !videoElement) {
                return;
            }
            const rootRect = rootContainer.getBoundingClientRect();
            const videoRect = videoElement.getBoundingClientRect();
            if (rootRect.width <= 0 || rootRect.height <= 0 || videoRect.width <= 0 || videoRect.height <= 0) {
                return;
            }
            geometry = {
                rootLeft: rootRect.left,
                rootTop: rootRect.top,
                rootWidth: rootRect.width,
                rootHeight: rootRect.height,
                videoLeft: videoRect.left,
                videoTop: videoRect.top,
                videoWidth: videoRect.width,
                videoHeight: videoRect.height,
            };
        };

        measureGeometry();
        const resizeObserver = typeof ResizeObserver !== 'undefined'
            ? new ResizeObserver(() => measureGeometry())
            : null;
        if (resizeObserver) {
            if (rootContainerRef.current) {
                resizeObserver.observe(rootContainerRef.current);
            }
            resizeObserver.observe(videoElement);
        }
        window.addEventListener('resize', measureGeometry);

        const syncVideos = () => {
            if (cancelled) return;
            const now = performance.now();
            if (now - lastDrawTime >= drawInterval) {
                const backgroundCanvas = ambientCanvasRef.current;
                const learningOpen = useChatPanel.getState().learningVisible;
                if (
                    !document.hidden &&
                    !learningOpen &&
                    geometry &&
                    backgroundCanvas &&
                    videoElement.readyState >= 2 &&
                    !videoElement.seeking &&
                    !videoElement.paused
                ) {
                    const ctx = backgroundCanvas.getContext('2d', { alpha: false });
                    if (ctx) {
                        const { rootLeft, rootTop, rootWidth, rootHeight, videoLeft, videoTop, videoWidth, videoHeight } = geometry;
                        const canvasW = AMBIENT_MAX_WIDTH;
                        const canvasH = Math.max(1, Math.round((rootHeight / rootWidth) * canvasW));

                        if (canvasW !== lastCanvasW || canvasH !== lastCanvasH) {
                            backgroundCanvas.width = canvasW;
                            backgroundCanvas.height = canvasH;
                            lastCanvasW = canvasW;
                            lastCanvasH = canvasH;
                        }

                        // 动态计算视频在根容器中的相对坐标与尺寸（适应分栏拖拽与全屏居中）
                        const relX = (videoLeft - rootLeft) / rootWidth;
                        const relY = (videoTop - rootTop) / rootHeight;
                        const relW = videoWidth / rootWidth;
                        const relH = videoHeight / rootHeight;

                        // 柔和向外溢出延伸，让光晕自然蔓延渗透到右侧和下方
                        const expandFactor = 0.25;
                        const drawX = Math.max(0, (relX - relW * expandFactor) * canvasW);
                        const drawY = Math.max(0, (relY - relH * expandFactor) * canvasH);
                        const drawW = Math.min(canvasW, relW * (1 + expandFactor * 2) * canvasW);
                        const drawH = Math.min(canvasH, relH * (1 + expandFactor * 2) * canvasH);

                        ctx.filter = 'none';
                        ctx.fillStyle = '#000';
                        ctx.fillRect(0, 0, canvasW, canvasH);
                        ctx.filter = `blur(${AMBIENT_CANVAS_BLUR_PX}px)`;
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
            resizeObserver?.disconnect();
            window.removeEventListener('resize', measureGeometry);
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
            {/* 顶层全局真实空间环境光 Canvas：覆盖整个播放器窗口；模糊已在低分画布内完成，scale-110 避免边缘暗边 */}
            <canvas
                ref={ambientCanvasRef}
                className={cn(
                    'absolute inset-0 w-full h-full scale-110 pointer-events-none transition-opacity duration-500 z-0',
                    'saturate-[1.1] brightness-[0.78]',
                    'dark:saturate-[1.15] dark:brightness-[0.52]',
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
                        {/* 视频与主字幕：学习页打开时只隐藏不卸载，切回播放时视频元素、播放进度与滚动位置全部保留 */}
                        <ResizablePanelGroup
                            direction={'vertical'}
                            className={cn('relative z-10', learningVisible && 'invisible')}
                        >
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
                                            'group relative h-2 w-full flex items-center justify-center',
                                            'bg-stone-300/80 dark:bg-neutral-800/80 hover:bg-stone-200/90 dark:hover:bg-neutral-700/90',
                                            'after:hidden transition-colors duration-150 cursor-row-resize z-20'
                                        )}
                                    >
                                        <div className="w-10 h-1 rounded-full bg-stone-500/70 dark:bg-neutral-400/70 group-hover:bg-rose-600 dark:group-hover:bg-rose-400 group-hover:w-14 transition-all duration-200 shadow-xs" />
                                    </ResizableHandle>
                                    <ResizablePanel
                                        className={cn('overflow-hidden bg-stone-50/75 dark:bg-neutral-800/65')}
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

                        {/* 整句学习页：占据视频与主字幕的位置，与播放器同一套外壳 */}
                        {learningMounted && (
                            <div className={cn('absolute inset-0 z-20', !learningVisible && 'invisible')}>
                                <LearningPage/>
                            </div>
                        )}

                        {/* 学习界面右下角的学习开关：外壳与播放画面胶囊同款、锚点相同，按钮落点因此不变 */}
                        {learningVisible && (
                            <div className={cn(CAPTION_CARD_ANCHOR_CLASS, 'z-30 pointer-events-auto', CAPTION_CARD_CLASS)}>
                                <LearningModeButton/>
                            </div>
                        )}
                    </div>
                </ResizablePanel>

                {!fullScreen && (
                    <>
                        <ResizableHandle
                            className={cn(
                                'group relative w-2 h-full flex items-center justify-center',
                                'bg-stone-300/80 dark:bg-neutral-800/80 hover:bg-stone-200/90 dark:hover:bg-neutral-700/90',
                                'after:hidden transition-colors duration-150 cursor-col-resize z-20'
                            )}
                        >
                            <div className="w-1 h-10 rounded-full bg-stone-500/70 dark:bg-neutral-400/70 group-hover:bg-rose-600 dark:group-hover:bg-rose-400 group-hover:h-14 transition-all duration-200 shadow-xs" />
                        </ResizableHandle>
                        <ResizablePanel
                            className={cn(
                                'relative overflow-hidden shadow-[inset_1px_1px_6px_rgba(0,0,0,0.06)] dark:shadow-[inset_1px_1px_8px_rgba(0,0,0,0.4)]',
                                // 学习页打开时把字幕列表提亮到与学习区面板一致的浅色系，关闭时平滑恢复
                                'transition-colors duration-300',
                                learningVisible
                                    ? 'bg-stone-100/85 dark:bg-neutral-800/85'
                                    : 'bg-stone-300/60 dark:bg-neutral-950/70'
                            )}
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
