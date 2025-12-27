import {cn} from "@/fronted/lib/utils";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/fronted/components/ui/resizable';
import Player from './Player';
import PodcastViewer from '@/fronted/pages/player/components/subtitles/podcast-viewer';
import MainSubtitle from './MainSubtitle';
import Subtitle from './components/Subtitle';
import React from 'react';
import useFile from '@/fronted/hooks/useFile';
import useLayout from '@/fronted/hooks/useLayout';
import { useLocalStorage } from '@uidotdev/usehooks';
import StrUtil from '@/common/utils/str-util';
import { getRendererLogger } from '@/fronted/log/simple-logger';
import { usePlayerV2Bridge } from '@/fronted/hooks/usePlayerV2Bridge';
import { useNavigate } from 'react-router-dom';
import { usePlayerV2State } from '@/fronted/hooks/usePlayerV2State';
import PlayerEmptyState from './PlayerEmptyState';

const logger = getRendererLogger('PlayerSrtLayout');

const PlayerSrtLayout = () => {
    const hasSubTitle = useFile((s) => StrUtil.isNotBlank(s.subtitlePath));
    const showSideBar = useLayout((state) => state.showSideBar);
    const fullScreen = useLayout((s) => s.fullScreen);
    const podcastMode = useLayout(s => s.podcastMode);
    const hasSource = usePlayerV2State((s) => !!s.src);
    const [sizeOa, setSizeOa] = useLocalStorage<number>('split-size-oa', 75);
    const [sizeOb, setSizeOb] = useLocalStorage<number>('split-size-ob', 25);
    const [sizeIa, setSizeIa] = useLocalStorage<number>('split-size-ia', 80);
    const [sizeIb, setSizeIb] = useLocalStorage<number>('split-size-ib', 20);
    const navigate = useNavigate();
    const { handlePlayerReady, handleAutoPlayNext } = usePlayerV2Bridge(navigate);
    const containerClass = cn(
        'w-full h-full flex flex-col border-0 border-white/90 drop-shadow-lg overflow-hidden',
        hasSubTitle && 'border-r-0',
        showSideBar && 'overflow-hidden border-[30px] border-background/80 rounded-[45px]'
    );

    if (!hasSource) {
        return (
            <div className={containerClass}>
                <PlayerEmptyState className="w-full" />
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
                            <div
                                className={cn('w-full h-full grid grid-cols-1 grid-rows-1')}>
                                <Player
                                    className={cn('row-start-1 row-end-2 col-start-1 col-end-2')}
                                    onReady={handlePlayerReady}
                                    onEnded={handleAutoPlayNext}
                                />
                                {podcastMode && <PodcastViewer
                                    className={cn('row-start-1 row-end-2 col-start-1 col-end-2 z-0')}
                                />}
                            </div>
                        </ResizablePanel>
                        {(!fullScreen && !podcastMode) && (
                            <>
                                <ResizableHandle withHandle
                                                 className={cn('drop-shadow data-[panel-group-direction=vertical]:h-2 dark:bg-zinc-700')} />
                                <ResizablePanel
                                    className={cn('ofvisible')}
                                    defaultSize={sizeIb}
                                    onResize={(e) => {
                                        if (fullScreen) {
                                            return;
                                        }
                                        setSizeIb(e);
                                    }}
                                ><MainSubtitle /></ResizablePanel>
                            </>
                        )}
                    </ResizablePanelGroup>
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

export default PlayerSrtLayout;
