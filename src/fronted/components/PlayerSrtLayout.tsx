import {cn} from "@/fronted/lib/utils";
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/fronted/components/ui/resizable';
import { darkColor, lightColor } from '@/fronted/styles/style';
import Player from '@/fronted/components/Player';
import PodcastViewer from '@/fronted/components/srt-cops/podcast-viewer';
import MainSubtitle from '@/fronted/components/MainSubtitle';
import Subtitle from '@/fronted/components/Subtitle';
import React from 'react';
import useFile from '@/fronted/hooks/useFile';
import useLayout from '@/fronted/hooks/useLayout';
import { useLocalStorage } from '@uidotdev/usehooks';
import StrUtil from '@/common/utils/str-util';
import WordList from '@/fronted/components/word-list/WordList';

const PlayerSrtLayout = () => {
    const hasSubTitle = useFile((s) => StrUtil.isNotBlank(s.subtitlePath));
    const showSideBar = useLayout((state) => state.showSideBar);
    const fullScreen = useLayout((s) => s.fullScreen);
    const podcastMode = useLayout(s => s.podcastMode);
    const [sizeOa, setSizeOa] = useLocalStorage<number>('split-size-oa', 75);
    const [sizeOb, setSizeOb] = useLocalStorage<number>('split-size-ob', 25);
    const [sizeIa, setSizeIa] = useLocalStorage<number>('split-size-ia', 80);
    const [sizeIb, setSizeIb] = useLocalStorage<number>('split-size-ib', 20);
    const showWordList = useLayout((s) => s.showWordList);
    const [sizeRight, setSizeRight] = useLocalStorage<number[]>('split-size-right', [50, 50]); // Moved to local usage or removed if not needed

    return (
        <div
            className={cn(
                'w-full h-full flex flex-col border-0 border-white/90 drop-shadow-lg overflow-hidden',
                hasSubTitle && 'border-r-0',
                // !isWindows && 'border-0',
                showSideBar &&
                'overflow-hidden border-[30px] border-background/80 rounded-[45px]'
            )}
        >
            <ResizablePanelGroup
                className={cn(
                    lightColor['bg-background'],
                    `dark:${darkColor['bg-background']}`
                )}
                direction={'horizontal'}>
                <ResizablePanel
                    defaultSize={sizeOa}
                    onResize={(e) => {
                        if (fullScreen) {
                            return;
                        }
                        console.log('eeeeeeb', e);
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
                                <Player className={cn('row-start-1 row-end-2 col-start-1 col-end-2')} />
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
                {(!fullScreen && hasSubTitle) && (
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
                            {showWordList ? (
                                <ResizablePanelGroup direction="vertical" onResize={setSizeRight} sizes={sizeRight}>
                                    <ResizablePanel>
                                        <Subtitle />
                                    </ResizablePanel>
                                    <ResizableHandle withHandle className={cn('drop-shadow data-[panel-group-direction=vertical]:h-2 dark:bg-zinc-700')} />
                                    <ResizablePanel>
                                        <WordList />
                                    </ResizablePanel>
                                </ResizablePanelGroup>
                            ) : (
                                <Subtitle />
                            )}
                        </ResizablePanel>
                    </>)}
            </ResizablePanelGroup>
        </div>
    )
}

export default PlayerSrtLayout;
