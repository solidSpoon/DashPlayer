import { AnimatePresence, motion } from 'framer-motion';
import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import Split from 'react-split';
import { useLocation, useParams, useSearchParams } from 'react-router-dom';
import useLayout, { cpW } from '../../../hooks/useLayout';
import { cn } from '../../../../common/utils/Util';
import FileBrowser from '../../../components/FileBrowser';
import ControlBox from '../../../components/ControlBox';
import MainSubtitle from '../../../components/MainSubtitle';
import Subtitle from '../../../components/Subtitle';
import Player from '../../../components/Player';
import UploadButton from '../../../components/UploadButton';
import useFile from '../../../hooks/useFile';
import GlobalShortCut from '../../../components/GlobalShortCut';
import SideBar from '../../../components/SideBar';
import useSystem from '../../../hooks/useSystem';

const api = window.electron;
const PlayerP = () => {
    const showSideBar = useLayout((state) => state.showSideBar);
    const titleBarHeight = useLayout((state) => state.titleBarHeight);
    const sizeA =
        localStorage.getItem('split-size-a') ?? JSON.stringify([75, 25]);
    const isWindows = useSystem((s) => s.isWindows);
    const sizeB =
        localStorage.getItem('split-size-b') ?? JSON.stringify([80, 20]);
    const w = cpW.bind(
        null,
        useLayout((s) => s.width)
    );
    const h = cpW.bind(
        null,
        useLayout((s) => s.height)
    );
    const { videoId } = useParams();
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
        setSearchParams({ sideBarAnimation: 'true' });
    }, [setSearchParams]);
    const posRef = useRef<HTMLDivElement>(null);
    const [pos, setPos] = useState({ x: 0, y: 0, scale: 1 });
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
                scale: rect.width / window.innerWidth
            });
        };
        updatePos();
        window.addEventListener('resize', updatePos);
        return () => {
            window.removeEventListener('resize', updatePos);
        };
    }, [titleBarHeight]);

    const showPlayer = w('md') && h('md');
    const gridTemplate = () => {
        if (showPlayer && w('lg')) {
            return '15% 60% 25%';
        }
        if (showPlayer) {
            return '65px calc((100% - 65px) * 12 / 17) calc((100% - 65px) * 5 / 17)';
        }
        if (!showPlayer && w('lg')) {
            return '15% 42.5% 42.5%';
        }
        return '65px calc((100% - 65px) * 1 / 2) calc((100% - 65px) * 1 / 2)';
    };
    return (
        <div className={cn('relative w-full h-full ')}>
            <div
                className='absolute inset-0 grid grid-cols-3 grid-rows-2 overflow-hidden'
                style={{
                    gridTemplateColumns: gridTemplate(),
                    gridTemplateRows: '30% 70%' // 这里定义每行的大小
                }}
            >
                {showSideBar && (
                    <>
                        <motion.div
                            className={cn(
                                'col-start-1 col-end-2 row-start-1 row-end-3'
                            )}
                            initial={{ x: -1000 }}
                            animate={{
                                x: 0
                            }}
                            exit={{ x: -1000 }}
                            transition={{
                                type: 'tween',
                                duration: sideBarAnimation ? 0 : 0
                            }}
                        >
                            <SideBar compact={!w('lg')} />
                        </motion.div>
                        <motion.div
                            className={cn(
                                'col-start-2 row-start-1 col-end-4 row-end-3 p-2',
                                h('md') && 'row-start-2',
                                w('md') && 'row-start-1 col-start-3 pl-1'
                            )}
                            initial={{ x: 1000 }}
                            animate={{
                                x: 0
                            }}
                            exit={{ x: 1000 }}
                            transition={{
                                type: 'tween',
                                duration: 0.2
                            }}
                        >
                            <FileBrowser />
                        </motion.div>

                        <motion.div
                            className={cn(
                                'hidden row-start-1 row-end-3 col-start-2  col-end-4 p-2',
                                w('md') && 'block col-end-3',
                                h('md') && 'block row-end-2'
                            )}
                            initial={{ y: -1000 }}
                            animate={{
                                y: 0,
                                x: 0
                            }}
                            exit={{ y: -1000 }}
                            transition={{
                                type: 'tween',
                                duration: 0.2
                            }}
                        >
                            <ControlBox />
                        </motion.div>
                    </>
                )}
                <div
                    className='p-4'
                    style={{
                        gridArea: '2 / 2 / 2 / 3'
                    }}
                >
                    <div className='w-full h-full' ref={posRef} />
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
                        transformOrigin: 'top left'
                    }}
                >
                    <div
                        className={cn(
                            'w-full h-full flex flex-col border-0 rounded border-white/90 drop-shadow-lg overflow-hidden',
                            hasSubTitle && 'border-r-0',
                            !isWindows && 'border-0',
                            showSideBar &&
                            'overflow-hidden border-[30px] border-white/90 rounded-[45px]'
                        )}
                    >
                        <Split
                            className={cn(
                                'flex flex-row h-0 flex-1 w-full bg-background overflow-hidden'
                            )}
                            sizes={JSON.parse(sizeA)}
                            onDragEnd={(sizes) => {
                                localStorage.setItem(
                                    'split-size-a',
                                    JSON.stringify(sizes)
                                );
                            }}
                        >
                            <Split
                                minSize={10}
                                className='split z-40'
                                sizes={JSON.parse(sizeB)}
                                onDragEnd={(sizes) => {
                                    localStorage.setItem(
                                        'split-size-b',
                                        JSON.stringify(sizes)
                                    );
                                }}
                                direction='vertical'
                            >
                                <div className='h-full'>
                                    <Player />
                                </div>
                                <div className='h-full'>
                                    <MainSubtitle />
                                </div>
                            </Split>
                            <div className={cn('h-full w-full relative', isWindows && !showSideBar && 'pt-2')}>
                                {isWindows && !showSideBar && (
                                    <div
                                        className={cn('absolute z-50 top-0 left-0 backdrop-blur h-9 w-full',
                                            'bg-gradient-to-b from-gray-300 to-gray-300/50',
                                            'dark:from-neutral-800 dark:to-neutral-800/50',
                                        )}>
                                    </div>)}
                                <Subtitle />
                            </div>
                        </Split>
                    </div>
                </div>
                <UploadButton />
                <GlobalShortCut />
            </div>
        </div>
    );
};

export default PlayerP;
