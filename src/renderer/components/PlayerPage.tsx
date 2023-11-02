import React from 'react';
import Split from 'react-split';
import { twJoin, twMerge } from 'tailwind-merge';
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

export interface PlayerPageParam {
    isDragging: boolean;
}

const PlayerPage = ({ isDragging }: PlayerPageParam) => {
    const theme = useSetting((s) => s.appearance.theme);
    const themeName = usingThemeName(theme);
    console.log('themeName', themeName);
    const fontSize = useSetting((s) => s.appearance.fontSize);
    const videoFile = useFile((s) => s.videoFile);
    const subtitleFile = useFile((s) => s.subtitleFile);
    const sizeA =
        localStorage.getItem('split-size-a') ?? JSON.stringify([75, 25]);
    const sizeB =
        localStorage.getItem('split-size-b') ?? JSON.stringify([80, 20]);
    const popType = usePlayerController((s) => s.popType);
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
                    'light bright dark deep colorful',
                    'fontSizeMedium',
                    'fontSizeSmall',
                    'fontSizeLarge'
                )}
            />
            <div
                className={twJoin(
                    `select-none h-screen w-full font-face-arc overflow-hidden flex flex-col `,
                    themeName,
                    fontSize,
                    isColorfulTheme(themeName)
                        ? 'bg-background/80 backdrop-blur'
                        : 'bg-background'
                )}
            >
                <TitleBar
                    hasSubTitle={subtitleFile !== undefined}
                    title={videoFile?.fileName}
                    windowsButtonClassName="hover:bg-titlebarHover"
                    className="bg-titlebar"
                />
                <GlobalShortCut />

                <Split
                    className="split flex flex-row w-full flex-1"
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
                {!isDragging && <UploadButton />}

                <div id="progressBarRef" className="z-50">
                    <BorderProgressBar />
                </div>
            </div>
            {popType === 'control' && <ControllerPage />}
        </>
    );
};

export default PlayerPage;
