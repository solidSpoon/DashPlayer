import React, { useRef } from 'react';
import './App.css';
import Split from 'react-split';
import Player from '../../components/Player';
import MainSubtitle from '../../components/MainSubtitle';
import UploadPhoto from '../../components/UploadButton';
import BorderProgressBar from '../../components/BorderProgressBar';
import GlobalShortCut from '../../components/GlobalShortCut';
import RecordProgress from '../../components/RecordProgress';
import '../../fonts/Archivo-VariableFont_wdth,wght.ttf';
import 'tailwindcss/tailwind.css';
import useSubtitle from '../../hooks/useSubtitle';
import useFile from '../../hooks/useFile';
import Subtitle from '../../components/Subtitle';
import useSubTitleController from '../../hooks/useSubTitleController';
import TitleBar from '../../components/TitleBar';

export default function App() {
    const progress = useRef<number>(0);
    const totalTime = useRef<number>(0);
    const [showTitleBar, setShowTitleBar] = React.useState<boolean>(false);
    const { videoFile, subtitleFile, updateFile } = useFile();
    const subtitles = useSubtitle(subtitleFile);
    const {
        seekAction: seekTime,
        currentSentence,
        dispatch: doAction,
    } = useSubTitleController(subtitles, () => progress.current);
    const sizeA =
        localStorage.getItem('split-size-a') ?? JSON.stringify([75, 25]);
    const sizeB =
        localStorage.getItem('split-size-b') ?? JSON.stringify([80, 20]);

    return (
        <>
            <TitleBar show={showTitleBar} title={videoFile?.fileName} />
            <RecordProgress
                getCurrentProgress={() => progress.current}
                getCurrentVideoFile={() => videoFile}
            />
            <GlobalShortCut onAction={doAction} />

            <Split
                className="split flex flex-row font-face-arc bg-neutral-800 h-screen w-full overflow-hidden"
                sizes={JSON.parse(sizeA)}
                onDragEnd={(sizes) => {
                    localStorage.setItem('split-size-a', JSON.stringify(sizes));
                }}
            >
                <Split
                    className="split"
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
                        />
                    </div>
                </Split>
                <Subtitle
                    subtitles={subtitles}
                    currentSentence={currentSentence}
                    onAction={doAction}
                />
            </Split>

            <UploadPhoto
                onFileChange={(file) => {
                    updateFile(file);
                }}
                onSelectingFile={(isSelect) => setShowTitleBar(isSelect)}
            />
            <div id="progressBarRef">
                <BorderProgressBar
                    getCurrentTime={() => progress.current}
                    getTotalTime={() => totalTime.current}
                />
            </div>
        </>
    );
}
