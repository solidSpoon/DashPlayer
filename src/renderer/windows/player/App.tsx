import React, { useRef, useState } from 'react';
import './App.css';
import Player from '../../components/Player';
import MainSubtitle from '../../components/MainSubtitle';
import UploadPhoto from '../../components/UplodeButton';
import BorderProgressBar from '../../components/BorderProgressBar';
import GlobalShortCut, { JumpPosition } from '../../components/GlobalShortCut';
import SentenceT from '../../lib/param/SentenceT';
import RecordProgress from '../../components/RecordProgress';
import '../../fonts/Archivo-VariableFont_wdth,wght.ttf';
import 'tailwindcss/tailwind.css';
import ResizeableSkeleton from '../../components/ResizeableSkeleton';
import useSubtitle from '../../hooks/useSubtitle';
import useFile from '../../hooks/useFile';
import SubtitleSub, { Action } from '../../components/SubtitleSub';
import { SeekTime } from '../../hooks/useSubTitleController';

export default function App() {
    /**
     * 当前播放时间
     * @private
     */
    const progress = useRef<number>(0);

    /**
     * 视频时长
     * @private
     */
    const totalTime = useRef<number>(0);

    const { videoFile, subtitleFile, updateFile } = useFile();
    const [currentSentence, setCurrentSentence] = useState<
        SentenceT | undefined
    >(undefined);
    const [jumpTo, setJumpTo] = useState<SeekTime>({
        time: 0,
        version: 0,
    });
    const [action, setAction] = useState<Action>({
        num: 0,
        action: 'none',
        target: undefined,
        time: undefined,
    });
    const [playState, setPlayState] = useState<boolean>(true);
    const subtitles = useSubtitle(subtitleFile);
    const onSpace = () => {
        setPlayState((prevState) => !prevState);
    };

    const onJumpTo = (position: JumpPosition) => {
        // if (subtitleRef.current === null) {
        //     console.log('subtitleRef is empty, can not jump');
        //     return;
        // }
        // if (JumpPosition.BEFORE === position) {
        //     this.subtitleRef.current.jumpPrev();
        // }
        // if (JumpPosition.AFTER === position) {
        //     this.subtitleRef.current.jumpNext();
        // }
        // if (JumpPosition.CURRENT === position) {
        //     this.subtitleRef.current.repeat();
        // }
    };

    const currentTime = () => progress.current;

    const onCurrentSentenceChange = (current: SentenceT) => {
        setCurrentSentence(current);
    };

    const onJumpToTime = (time: number) => {
        setJumpTo((prevState) => ({
            time,
            version: prevState.version + 1,
            sentence: undefined,
        }));
    };

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
                    onJumpTo={onJumpToTime}
                    seekTime={jumpTo}
                    playingState={playState}
                    setPlayingState={(state) => {
                        setPlayState(state);
                    }}
                />
            </>
        );
        const subtitle = (
            <SubtitleSub
                getCurrentTime={currentTime}
                onCurrentSentenceChange={onCurrentSentenceChange}
                seekTo={onJumpToTime}
                subtitles={subtitles}
                action={action}
            />
        );
        const mainSubtitle = <MainSubtitle sentence={currentSentence} />;
        return (
            <div className="font-face-arc bg-neutral-800">
                <GlobalShortCut
                    onJumpTo={(position) => onJumpTo(position)}
                    onSpace={() => onSpace()}
                />
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
