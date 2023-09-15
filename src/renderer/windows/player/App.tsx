import React, { useRef, useState } from 'react';
import './App.css';
import Player from '../../components/Player';
import MainSubtitle from '../../components/MainSubtitle';
import UploadPhoto from '../../components/UplodeButton';
import BorderProgressBar from '../../components/BorderProgressBar';
import GlobalShortCut from '../../components/GlobalShortCut';
import RecordProgress from '../../components/RecordProgress';
import '../../fonts/Archivo-VariableFont_wdth,wght.ttf';
import 'tailwindcss/tailwind.css';
import ResizeableSkeleton from '../../components/ResizeableSkeleton';
import useSubtitle from '../../hooks/useSubtitle';
import useFile from '../../hooks/useFile';
import Subtitle from '../../components/Subtitle';
import useSubTitleController from '../../hooks/useSubTitleController';

export default function App() {
    const progress = useRef<number>(0);
    const totalTime = useRef<number>(0);

    const { videoFile, subtitleFile, updateFile } = useFile();
    const subtitles = useSubtitle(subtitleFile);
    const {
        seekAction: seekTime,
        currentSentence,
        dispatch: doAction,
    } = useSubTitleController(subtitles, () => progress.current);

    const render = () => {
        const player = (
            <>
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
            </>
        );
        const subtitle = (
            <Subtitle
                subtitles={subtitles}
                currentSentence={currentSentence}
                onAction={doAction}
            />
        );
        const mainSubtitle = <MainSubtitle sentence={currentSentence} />;
        return (
            <div className="font-face-arc bg-neutral-800">
                <GlobalShortCut onAction={doAction} />
                <RecordProgress
                    getCurrentProgress={() => progress.current}
                    getCurrentVideoFile={() => videoFile}
                />
                <ResizeableSkeleton
                    player={player}
                    currentSentence={mainSubtitle}
                    subtitle={subtitle}
                />

                <UploadPhoto onFileChange={updateFile} />
                <div id="progressBarRef">
                    <BorderProgressBar
                        getCurrentTime={() => progress.current}
                        getTotalTime={() => totalTime.current}
                    />
                </div>
            </div>
        );
    };

    return render();
}
