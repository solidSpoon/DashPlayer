import { AnimatePresence, motion } from 'framer-motion';
import React, { useEffect, useRef, useState } from 'react';
import Split from 'react-split';
import { useLocation, useParams, useSearchParams } from 'react-router-dom';
import useLayout from '../../../hooks/useLayout';
import { cn } from '../../../../utils/Util';
import FileBrowser from '../../../components/FileBrowser';
import ControlBox from '../../../components/ControlBox';
import MainSubtitle from '../../../components/MainSubtitle';
import Subtitle from '../../../components/Subtitle';
import Player from '../../../components/Player';
import UploadButton from '../../../components/UploadButton';
import BorderProgressBar from '../../../components/BorderProgressBar';
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
    const sizeB =
        localStorage.getItem('split-size-b') ?? JSON.stringify([80, 20]);
    const { videoId } = useParams();
    const playFile = useFile((s) => s.playFile);
   const isWindows = useSystem(s=>s.isWindows);
    const location = useLocation();
    const sideBarAnimation =
        (new URLSearchParams(location.search).get('sideBarAnimation') ??
            'true') === 'true';
    const [searchParams, setSearchParams] = useSearchParams();
    const referrer = location.state && location.state.referrer;
    console.log('referrer', referrer);
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
    const [pos, setPos] = useState({ x: 0, y: 0 });
    useEffect(() => {
        const updatePos = () => {
            if (posRef.current === null) return 0;
            const rect = posRef.current.getBoundingClientRect();
            setPos({
                x: rect.x,
                y: rect.y - titleBarHeight + (window.innerHeight - titleBarHeight) * 0.05,
            });
        }
        updatePos();
        window.addEventListener('resize', updatePos);
        return () => {
            window.removeEventListener('resize', updatePos);
        }
    }, []);
    return (
        <div
            className="w-full h-full grid grid-cols-3 grid-rows-2 overflow-hidden bg-gray-100"
            style={{
                gridTemplateColumns: '15% 60% 25%', // 这里定义每列的大小
                gridTemplateRows: '30% 70%', // 这里定义每行的大小
            }}
        >

            <AnimatePresence>
                {showSideBar && (
                    <>
                        <motion.div
                            className={cn(
                                'col-start-1 col-end-2 row-start-1 row-end-3'
                            )}
                            initial={{ x: -1000 }}
                            animate={{
                                x: 0,
                            }}
                            exit={{ x: -1000 }}
                            transition={{
                                type: 'tween',
                                duration: sideBarAnimation ? 0.2 : 0,
                            }}
                        >
                            <SideBar />
                        </motion.div>
                        <motion.div
                            className={cn(
                                'col-start-3 col-end-4 row-start-1 row-end-3 p-4 pl-2'
                            )}
                            initial={{ x: 1000 }}
                            animate={{
                                x: 0,
                            }}
                            exit={{ x: 1000 }}
                            transition={{
                                type: 'tween',
                                duration: 0.2,
                            }}
                        >
                            <FileBrowser />
                        </motion.div>

                        <motion.div
                            className={cn(
                                'col-start-2 col-end-3 row-start-1 row-end-2 p-4 pb-2 pr-2'
                            )}
                            initial={{ y: -1000 }}
                            animate={{
                                y: 0,
                                x: 0,
                            }}
                            exit={{ y: -1000 }}
                            transition={{
                                type: 'tween',
                                duration: 0.2,
                            }}
                        >
                            <ControlBox />
                        </motion.div>
                    </>
                )}
            </AnimatePresence>
            <div
                className={""}
                ref={posRef}
                style={{
                    gridArea: '2 / 2 / 2 / 3',
                }}
            />
            <div
                className={cn(
                    'flex flex-col',
                    showSideBar && 'p-4 pt-2 pr-2',
                )}
                style={{
                    // gridArea: showSideBar ? '2 / 2 / 2 / 3' : '1 / 1 / -1 / -1',
                    gridArea: '1 / 1 / -1 / -1',
                    transform: showSideBar?`translate(${pos.x}px, ${pos.y}px) scale(0.6)`:'translate(0px, 0px) scale(1)',
                    transformOrigin: 'top left',
                }}
            >
                <div
                    className={cn(
                        'w-full h-full flex flex-col',
                        showSideBar &&
                        'overflow-hidden border-2 border-gray-300 rounded-lg'
                    )}
                    style={{
                        // zoom: showSideBar ? 0.65 : 1,
                    }}
                >
                    <Split
                        className={cn(
                            'flex flex-row h-0 flex-1 w-full bg-background'
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
                            className="split z-40"
                            sizes={JSON.parse(sizeB)}
                            onDragEnd={(sizes) => {
                                localStorage.setItem(
                                    'split-size-b',
                                    JSON.stringify(sizes)
                                );
                            }}
                            direction="vertical"
                        >
                            <div className="h-full">
                                <Player />
                            </div>
                            <div
                                style={{
                                    // zoom: showSideBar ? 0.65 : 1,
                                }}
                                className="h-full">
                                <MainSubtitle />
                            </div>
                        </Split>
                        <Subtitle />
                    </Split>
                    <div className={cn('h-2')}>
                        <BorderProgressBar />
                    </div>
                </div>
            </div>
            <UploadButton />
            <GlobalShortCut />
        </div>
    );
};

export default PlayerP;
