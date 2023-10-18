import React, { useRef } from 'react';
import Split from 'react-split';
import useSubtitle from '../hooks/useSubtitle';
import useSubTitleController, {
    SPACE_NUM,
} from '../hooks/useSubTitleController';
import TitleBar from './TitleBar/TitleBar';
import RecordProgress from './RecordProgress';
import GlobalShortCut from './GlobalShortCut';
import Player from './Player';
import MainSubtitle from './MainSubtitle';
import Subtitle from './Subtitle';
import BorderProgressBar from './BorderProgressBar';
import UploadButton from './UploadButton';
import useFile from '../hooks/useFile';
import useSetting from '../hooks/useSetting';

export interface PlayerPageParam {
    isDragging: boolean;
}

const PlayerPage = ({ isDragging }: PlayerPageParam) => {
    const themeName = useSetting((s) => s.appearance.theme);
    const fontSize = useSetting((s) => s.appearance.fontSize);
    const progress = useRef<number>(0);
    const totalTime = useRef<number>(0);
    const videoFile = useFile((s) => s.videoFile);
    const subtitleFile = useFile((s) => s.subtitleFile);
    const subtitles = useSubtitle((s) => s.subtitle);
    const {
        seekAction: seekTime,
        currentSentence,
        dispatch: doAction,
        showCn,
        showEn,
        singleRepeat,
    } = useSubTitleController(subtitles, () => progress.current);
    const sizeA =
        localStorage.getItem('split-size-a') ?? JSON.stringify([75, 25]);
    const sizeB =
        localStorage.getItem('split-size-b') ?? JSON.stringify([80, 20]);
    return (
        <div
            className={`select-none h-screen w-full bg-background font-face-arc overflow-hidden flex flex-col ${themeName} ${fontSize}`}
        >
            <TitleBar
                hasSubTitle={subtitleFile !== undefined}
                title={videoFile?.fileName}
                windowsButtonClassName="hover:bg-titlebarHover"
                className="bg-titlebar"
            />
            <RecordProgress
                getCurrentProgress={() => progress.current}
                getTotalTime={() => totalTime.current}
            />
            <GlobalShortCut onAction={doAction} />

            <Split
                minSize={10}
                className="split flex flex-row w-full flex-1"
                sizes={JSON.parse(sizeA)}
                onDragEnd={(sizes) => {
                    localStorage.setItem('split-size-a', JSON.stringify(sizes));
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
                        <Player
                            onProgress={(time) => {
                                progress.current = time;
                            }}
                            onTotalTimeChange={(time) => {
                                totalTime.current = time;
                            }}
                            onAction={doAction}
                            seekTime={seekTime}
                        />
                    </div>
                    <div className="h-full">
                        <MainSubtitle
                            sentence={currentSentence}
                            doAction={doAction}
                            showEn={showEn}
                            showCn={showCn}
                        />
                    </div>
                </Split>
                <Subtitle
                    subtitles={subtitles}
                    currentSentence={currentSentence}
                    onAction={doAction}
                    singleRepeat={singleRepeat}
                    pause={seekTime.time === SPACE_NUM}
                />
            </Split>
            {!isDragging && <UploadButton />}

            <div id="progressBarRef" className="z-50">
                <BorderProgressBar
                    hasSubTitle={subtitleFile !== undefined}
                    getCurrentTime={() => progress.current}
                    getTotalTime={() => totalTime.current}
                />
            </div>
        </div>
    );
};

export default PlayerPage;
