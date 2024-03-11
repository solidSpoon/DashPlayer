import {motion} from 'framer-motion';
import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import Split from 'react-split';
import {useLocation, useParams, useSearchParams} from 'react-router-dom';
import useLayout, {cpW} from '@/fronted/hooks/useLayout';
import {cn} from '@/common/utils/Util';
import FileBrowser from '@/fronted/components/FileBrowser';
import ControlBox from '@/fronted/components/ControlBox';
import MainSubtitle from '@/fronted/components/MainSubtitle';
import Subtitle from '@/fronted/components/Subtitle';
import Player from '@/fronted/components/Player';
import UploadButton from '@/fronted/components/UploadButton';
import useFile from '@/fronted/hooks/useFile';
import GlobalShortCut from '@/fronted/components/GlobalShortCut';
import SideBar from '@/fronted/components/SideBar';
import useSystem from '@/fronted/hooks/useSystem';
import {darkColor, FONT_SIZE, lightColor, themeProvider} from "@/fronted/styles/style";
import {ResizableHandle, ResizablePanel, ResizablePanelGroup} from "@/fronted/components/ui/resizable";
import {useLocalStorage} from "@uidotdev/usehooks";

const api = window.electron;

interface Size {
    oa: number;
    ob: number;
    ia: number;
    ib: number;
}

const PlayerP = () => {
    const showSideBar = useLayout((state) => state.showSideBar);
    const titleBarHeight = useLayout((state) => state.titleBarHeight);
    const [sizeOa, setSizeOa] = useLocalStorage<number>('split-size-oa', 75);
    const [sizeOb, setSizeOb] = useLocalStorage<number>('split-size-ob', 25);
    const [sizeIa, setSizeIa] = useLocalStorage<number>('split-size-ia', 80);
    const [sizeIb, setSizeIb] = useLocalStorage<number>('split-size-ib', 20);
    const w = cpW.bind(
        null,
        useLayout((s) => s.width)
    );
    const h = cpW.bind(
        null,
        useLayout((s) => s.height)
    );
    const fullScreen = useLayout((s) => s.fullScreen);
    const {videoId} = useParams();
    const playFile = useFile((s) => s.playFile);
    const location = useLocation();
    const sideBarAnimation =
        (new URLSearchParams(location.search).get('sideBarAnimation') ??
            'true') === 'true';
    const [searchParams, setSearchParams] = useSearchParams();
    const referrer = location.state && location.state.referrer;
    console.log('referrer', referrer);
    const hasSubTitle = useFile((s) => s.subtitleFile !== undefined);
    useEffect(() => {
        const runEffect = async () => {
            if (videoId === undefined) return;
            const video = await api.getVideo(Number(videoId));
            console.log('video', video);
            if (video === undefined) return;
            playFile(video);
        };

        runEffect();
    }, [playFile, videoId]);
    useEffect(() => {
        setSearchParams({sideBarAnimation: 'true'});
    }, [setSearchParams]);
    const posRef = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState({x: 0, y: 0, scale: 1});
    useLayoutEffect(() => {
        const updatePos = () => {
            if (posRef.current === null) {
                return;
            }
            const rect = posRef.current.getBoundingClientRect();
            setPos({
                x: rect.x,
                y:
                    rect.y -
                    titleBarHeight +
                    (window.innerHeight - titleBarHeight) * 0.05,
                scale: rect.width / window.innerWidth,
            });
        };
        updatePos();
        window.addEventListener('resize', updatePos);
        return () => {
            window.removeEventListener('resize', updatePos);
        };
    }, [titleBarHeight]);

    const showPlayer = w('md') && h('md');
    // useEffect(() => {
    //     console.log('eeeeeeesize', size);
    // }, [size]);
    const gridTemplate = () => {
        if (showPlayer && w('xl')) {
            return '15% 60% 25%';
        }
        if (showPlayer) {
            return '65px calc((100% - 65px) * 12 / 17) calc((100% - 65px) * 5 / 17)';
        }
        if (!showPlayer && w('xl')) {
            return '15% 42.5% 42.5%';
        }
        return '65px calc((100% - 65px) * 1 / 2) calc((100% - 65px) * 1 / 2)';
    };
    return (
        <div className={cn('relative w-full h-full ')}>
            <div
                className="absolute inset-0 grid grid-cols-3 grid-rows-2 overflow-hidden"
                style={{
                    gridTemplateColumns: gridTemplate(),
                    gridTemplateRows: '30% 70%', // 这里定义每行的大小
                }}
            >
                {showSideBar && (
                    <>
                        <motion.div
                            className={cn(
                                'col-start-1 col-end-2 row-start-1 row-end-3'
                            )}
                            initial={{x: -1000}}
                            animate={{
                                x: 0,
                            }}
                            exit={{x: -1000}}
                            transition={{
                                type: 'tween',
                                duration: sideBarAnimation ? 0 : 0,
                            }}
                        >
                            <SideBar compact={!w('xl')}/>
                        </motion.div>
                        <motion.div
                            className={cn(
                                'col-start-2 row-start-1 col-end-4 row-end-3 p-2',
                                h('md') && 'row-start-2',
                                w('md') && 'row-start-1 col-start-3 pl-1'
                            )}
                            initial={{x: 1000}}
                            animate={{
                                x: 0,
                            }}
                            exit={{x: 1000}}
                            transition={{
                                type: 'tween',
                                duration: 0.2,
                            }}
                        >
                            <FileBrowser/>
                        </motion.div>

                        <motion.div
                            className={cn(
                                'hidden row-start-1 row-end-3 col-start-2  col-end-4 p-2',
                                w('md') && 'block col-end-3',
                                h('md') && 'block row-end-2'
                            )}
                            initial={{y: -1000}}
                            animate={{
                                y: 0,
                                x: 0,
                            }}
                            exit={{y: -1000}}
                            transition={{
                                type: 'tween',
                                duration: 0.2,
                            }}
                        >
                            <ControlBox/>
                        </motion.div>
                    </>
                )}
                <div
                    className="p-4"
                    style={{
                        gridArea: '2 / 2 / 2 / 3',
                    }}
                >
                    <div className="w-full h-full" ref={posRef}/>
                </div>
                <div
                    className={cn(
                        'flex flex-col',
                        showSideBar && 'p-4 pt-2 pr-2',
                        !((w('md') && h('md')) || !showSideBar) && 'hidden'
                    )}
                    style={{
                        gridArea: '1 / 1 / -1 / -1',
                        transform: showSideBar
                            ? `translate(${pos.x}px, ${pos.y}px) scale(${pos.scale})`
                            : 'translate(0px, 0px) scale(1)',
                        transformOrigin: 'top left',
                    }}
                >
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
                                lightColor["bg-background"],
                                `dark:${darkColor["bg-background"]}`
                            )}
                            direction={"horizontal"}>
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
                                <ResizablePanelGroup direction={"vertical"}>
                                    <ResizablePanel
                                        minSize={10}
                                        defaultSize={sizeIa}
                                        onResize={(e) => {
                                            if (fullScreen) {
                                                return;
                                            }
                                            setSizeIa(e);
                                        }}
                                    ><Player/></ResizablePanel>
                                    {!fullScreen && (
                                        <>
                                            <ResizableHandle withHandle
                                                             className={cn('drop-shadow data-[panel-group-direction=vertical]:h-2 dark:bg-zinc-700')}/>
                                            <ResizablePanel
                                                className={cn('ofvisible')}
                                                defaultSize={sizeIb}
                                                onResize={(e) => {
                                                    if (fullScreen) {
                                                        return;
                                                    }
                                                    setSizeIb(e);
                                                }}
                                            ><MainSubtitle/></ResizablePanel>
                                        </>
                                    )}
                                </ResizablePanelGroup>
                            </ResizablePanel>
                            {!fullScreen && (
                                <>
                                    <ResizableHandle withHandle className={cn("gutter-style w-2 dark:bg-zinc-700")}/>
                                    <ResizablePanel
                                        defaultSize={sizeOb}
                                        onResize={(e) => {
                                            if (fullScreen) {
                                                return;
                                            }
                                            console.log('eeeeeea', e);
                                            setSizeOb(e);
                                        }}
                                    >
                                        <Subtitle/>
                                    </ResizablePanel>
                                </>)}
                        </ResizablePanelGroup>
                    </div>
                </div>
                <UploadButton/>
                <GlobalShortCut/>
            </div>
        </div>
    )
        ;
};

export default PlayerP;
