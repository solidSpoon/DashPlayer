import { AnimatePresence, motion } from 'framer-motion';
import React, { useEffect } from 'react';
import Split from 'react-split';
import { useLocation, useParams } from 'react-router-dom';
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
import GlobalShortCut from "../../../components/GlobalShortCut";

const api = window.electron;
const PlayerP = () => {
    const showSideBar = useLayout((state) => state.showSideBar);
    const sizeA =
        localStorage.getItem('split-size-a') ?? JSON.stringify([75, 25]);
    const sizeB =
        localStorage.getItem('split-size-b') ?? JSON.stringify([80, 20]);
    const { videoId } = useParams();
    const playFile = useFile((s) => s.playFile);
    const location = useLocation();
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
    return (
        <div
            className="w-full h-full grid grid-cols-2 grid-rows-2"
            style={{
                gridTemplateColumns: '65% 35%', // 这里定义每列的大小
                gridTemplateRows: '30% 70%', // 这里定义每行的大小
            }}
        >
            <AnimatePresence>
                {showSideBar && (
                    <>
                        <motion.div
                            className={cn(
                                'col-start-2 col-end-3 row-start-1 row-end-3 p-4 pl-2'
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
                                'col-start-1 col-end-2 row-start-1 row-end-2 p-4 pb-2 pr-2 overflow-hidden'
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
            <motion.div
                className={cn(
                    'flex flex-col',
                    showSideBar && 'p-4 pt-2 pr-2 overflow-hidden'
                )}
                layout
                transition={{
                    type: 'tween',
                    duration: 0.2,
                    stiffness: 5000,
                    damping: 200,
                }}
                style={{
                    gridArea: showSideBar ? '2 / 1 / 2 / 2' : '1 / 1 / -1 / -1',
                }}
            >
                <div
                    className={cn(
                        'w-full h-full flex flex-col',
                        showSideBar &&
                            'rounded-lg overflow-hidden border-2 border-gray-300]'
                    )}
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
                            <div className="h-full">
                                <MainSubtitle />
                            </div>
                        </Split>
                        <Subtitle />
                    </Split>
                    <div className={cn('h-2')}>
                        <BorderProgressBar />
                    </div>
                </div>
            </motion.div>
            <UploadButton />
            <GlobalShortCut />
        </div>
    );
};

export default PlayerP;
