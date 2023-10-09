import React, { useRef } from 'react';
import './App.css';
import Split from 'react-split';
import Player from '../../components/Player';
import MainSubtitle from '../../components/MainSubtitle';
import UploadButton from '../../components/UploadButton';
import BorderProgressBar from '../../components/BorderProgressBar';
import GlobalShortCut from '../../components/GlobalShortCut';
import RecordProgress from '../../components/RecordProgress';
import '../../fonts/Archivo-VariableFont_wdth,wght.ttf';
import 'tailwindcss/tailwind.css';
import useSubtitle from '../../hooks/useSubtitle';
import useFile from '../../hooks/useFile';
import Subtitle from '../../components/Subtitle';
import useSubTitleController, {
    SPACE_NUM,
} from '../../hooks/useSubTitleController';
import TitleBar from '../../components/TitleBar';
import FileDrop from '../../components/FileDrop';

export const api = window.electron;
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
        showCn,
        showEn,
        singleRepeat,
    } = useSubTitleController(subtitles, () => progress.current);
    const sizeA =
        localStorage.getItem('split-size-a') ?? JSON.stringify([75, 25]);
    const sizeB =
        localStorage.getItem('split-size-b') ?? JSON.stringify([80, 20]);
    return (
        <FileDrop onFileChange={updateFile}>
            <div className="h-screen w-full bg-background font-face-arc overflow-hidden flex flex-col">
                <TitleBar
                    hasSubTitle={subtitleFile !== undefined}
                    show={showTitleBar}
                    title={videoFile?.fileName}
                />
                <RecordProgress
                    getCurrentProgress={() => progress.current}
                    videoFile={videoFile}
                />
                <GlobalShortCut onAction={doAction} />

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
                <div id="progressBarRef" className="z-50">
                    <BorderProgressBar
                        hasSubTitle={subtitleFile !== undefined}
                        getCurrentTime={() => progress.current}
                        getTotalTime={() => totalTime.current}
                    />
                </div>
            </div>
        </FileDrop>
    );
}
