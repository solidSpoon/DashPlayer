import React, { useEffect } from 'react';
import Split from 'react-split';
import { twJoin, twMerge } from 'tailwind-merge';
import { motion, AnimatePresence } from 'framer-motion';
import TitleBar from './TitleBar/TitleBar';
import GlobalShortCut from './GlobalShortCut';
import Player from './Player';
import MainSubtitle from './MainSubtitle';
import Subtitle from './Subtitle';
import BorderProgressBar from './BorderProgressBar';
import UploadButton from './UploadButton';
import useFile from '../hooks/useFile';
import useSetting, {
    colorfulProp,
    isColorfulTheme,
    usingThemeName,
} from '../hooks/useSetting';
import { cn } from '../../utils/Util';
import { THEME } from '../../types/Types';
import ControllerPage from './ControllerPage/ControllerPage';
import usePlayerController from '../hooks/usePlayerController';
import FileBrowser from './FileBrowser';
import ControlBox from './ControlBox';
import SideBar from './SideBar';

export interface PlayerPageParam {
    isDragging: boolean;
}

const PlayerPage = ({ isDragging }: PlayerPageParam) => {
    const theme = useSetting((s) => s.appearance.theme);
    const themeName = usingThemeName(theme);
    const fontSize = useSetting((s) => s.appearance.fontSize);
    const videoFile = useFile((s) => s.videoFile);
    const subtitleFile = useFile((s) => s.subtitleFile);
    const sizeA =
        localStorage.getItem('split-size-a') ?? JSON.stringify([75, 25]);
    const sizeB =
        localStorage.getItem('split-size-b') ?? JSON.stringify([80, 20]);
    const popType = usePlayerController((s) => s.popType);
    const [change, setChange] = React.useState(false);
    useEffect(() => {
        const interval = setInterval(() => {
            setChange(!change);
        }, 5000);
        return () => {
            clearInterval(interval);
        };
    }, [change]);
    const multiTask = popType !== 'none';
    return (
        <>
            {isColorfulTheme(themeName) && (
                <div
                    className={twJoin(
                        'absolute h-screen w-full -z-50',
                        colorfulProp(theme)
                    )}
                />
            )}
            <div
                className={twJoin(
                    'absolute -z-50 invisible',
                    'light dark',
                    'fontSizeMedium',
                    'fontSizeSmall',
                    'fontSizeLarge'
                )}
            />
            {popType !== 'word' && (
                <div
                    className={twJoin(
                        `select-none h-screen w-full font-face-arc overflow-hidden flex flex-col bg-white`,
                        fontSize
                    )}
                >
                    <TitleBar
                        hasSubTitle={subtitleFile !== undefined}
                        title={videoFile?.fileName}
                        windowsButtonClassName="hover:bg-titlebarHover"
                        className="bg-titlebar"
                    />
                    <GlobalShortCut />
                    <div
                        className={cn(
                            'split flex flex-row w-full flex-1 bg-neutral-800',
                            'grid grid-cols-3 grid-rows-2'
                        )}
                        style={{
                            gridTemplateColumns: '10% 60% 30%', // 这里定义每列的大小
                            gridTemplateRows: '30% 70%', // 这里定义每行的大小
                        }}
                    >
                        {multiTask && (
                            <AnimatePresence>
                                <motion.div
                                    className={cn(
                                        'bg-white col-start-1 col-end-2 row-start-1 row-end-3'
                                    )}
                                    initial={{ x: -1000 }}
                                    animate={{
                                        x: 0,
                                    }}
                                    exit={{ x: -1000 }}
                                    transition={{
                                        type: 'tween',
                                        duration: 0.3,
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
                                        duration: 0.3,
                                    }}
                                >
                                    <FileBrowser />
                                </motion.div>

                                <motion.div
                                    className={cn(
                                        'col-start-2 col-end-3 row-start-1 row-end-2 p-4 pb-2 pr-2 overflow-hidden'
                                    )}
                                    initial={{ y: -1000 }}
                                    animate={{
                                        y: 0,
                                    }}
                                    exit={{ y: -1000 }}
                                    transition={{
                                        type: 'tween',
                                        duration: 0.3,
                                    }}
                                >
                                    <ControlBox />
                                </motion.div>
                            </AnimatePresence>
                        )}
                        <motion.div
                            className={cn(
                                multiTask && 'p-4 pt-2 pr-2 overflow-hidden'
                            )}
                            layout
                            transition={{
                                type: 'spring',
                                stiffness: 700,
                                damping: 30,
                            }}
                            style={{
                                gridArea:
                                    popType === 'none'
                                        ? '1 / 1 / -1 / -1'
                                        : '2 / 2 / -1 / -2 ',
                            }}
                        >
                            <Split
                                className={cn(
                                    'flex flex-row h-full w-full bg-background',
                                    multiTask &&
                                        'rounded-lg overflow-hidden border-2 border-gray-300]'
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
                        </motion.div>
                    </div>

                    {!isDragging && <UploadButton />}

                    <div id="progressBarRef" className="z-50">
                        <BorderProgressBar />
                    </div>
                </div>
            )}
            {/* {(popType === 'classNameontrol' || popType === 'word') && ( */}
            {/*     <ControllerPage /> */}
            {/* )} */}
        </>
    );
};

export default PlayerPage;
