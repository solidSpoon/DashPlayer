import {cn} from "@/fronted/lib/utils";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/fronted/components/ui/resizable';
import PlaybackStage from './Stage';
import PodcastViewer from '@/fronted/features/player/components/subtitles/PodcastViewer';
import MainSubtitle from './MainSubtitle';
import Subtitle from './components/Subtitle';
import React from 'react';
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
                    <div className="relative w-full h-full">
                        <ResizablePanelGroup direction={'vertical'}>
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
                                />
                            </ResizablePanel>
                            {!fullScreen && !podcastMode && (
                                <>
                                    <ResizableHandle
                                        className={cn(
                                            'group relative h-2.5 w-full flex items-center justify-center bg-stone-200/90 dark:bg-neutral-800/90 border-t border-black/10 dark:border-white/10 hover:bg-stone-300/80 dark:hover:bg-neutral-700/80 transition-colors cursor-row-resize'
                                        )}
                                    >
                                        <div className="w-12 h-1 rounded-full bg-stone-400/60 dark:bg-neutral-500/60 group-hover:bg-stone-600 dark:group-hover:bg-neutral-300 group-hover:w-16 transition-all duration-200" />
                                    </ResizableHandle>
                                    <ResizablePanel
                                        className={cn('ofvisible bg-stone-200/90 dark:bg-neutral-800/90')}
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
