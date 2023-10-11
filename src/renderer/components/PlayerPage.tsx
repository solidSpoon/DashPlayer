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
import FileT from '../lib/param/FileT';
import UploadButton from './UploadButton';

export interface PlayerPageParam {
    videoFile: FileT | undefined;
    subtitleFile: FileT | undefined;
    updateFile: (file: FileT) => void;
}

const PlayerPage = ({
    videoFile,
    subtitleFile,
    updateFile,
}: PlayerPageParam) => {
    const progress = useRef<number>(0);
    const totalTime = useRef<number>(0);
    const subtitles = useSubtitle(subtitleFile);
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
        <div className="h-screen w-full bg-background font-face-arc overflow-hidden flex flex-col">
            <TitleBar
                hasSubTitle={subtitleFile !== undefined}
                title={videoFile?.fileName}
                windowsButtonClassName="hover:bg-titlebarHover"
                className="bg-titlebar"
            />
            <RecordProgress
                getCurrentProgress={() => progress.current}
                videoFile={videoFile}
                subtitleFile={subtitleFile}
            />
            <GlobalShortCut onAction={doAction} />

            <Split
                className="split flex flex-row w-full flex-1"
                sizes={JSON.parse(sizeA)}
                onDragEnd={(sizes) => {
                    localStorage.setItem('split-size-a', JSON.stringify(sizes));
                }}
            >
                <Split
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
                            videoFile={videoFile}
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

            <UploadButton onFileChange={updateFile} />

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
