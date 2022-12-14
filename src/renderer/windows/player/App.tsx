import React, { Component } from 'react';
import './App.css';
import FileT, { FileType } from '../../lib/param/FileT';
import Player from '../../components/Player';
import Subtitle from '../../components/Subtitle';
import MainSubtitle from '../../components/MainSubtitle';
import PlayTime from '../../components/PlayTime';
import UploadPhoto from '../../components/UplodeButton';
import BorderProgressBar from '../../components/BorderProgressBar';
import GlobalShortCut, { JumpPosition } from '../../components/GlobalShortCut';
import SentenceT from '../../lib/param/SentenceT';
import RecordProgress from '../../components/RecordProgress';
import '../../fonts/Archivo-VariableFont_wdth,wght.ttf';
import 'tailwindcss/tailwind.css';
import ResizeableSkeleton from '../../components/ResizeableSkeleton';

interface HomeState {
    /**
     * 视频文件
     * @private
     */
    videoFile: FileT | undefined;
    /**
     * 字幕文件
     * @private
     */
    subtitleFile: FileT | undefined;

    currentSentence: SentenceT | undefined;
}

export default class App extends Component<any, HomeState> {
    /**
     * 当前播放时间
     * @private
     */
    private progress: number;

    /**
     * 播放器引用
     * @private
     */
    private playerRef: React.RefObject<Player>;

    /**
     * 视频时长
     * @private
     */
    private totalTime: number;

    /**
     * 侧边字幕组件引用
     * @private
     */
    private subtitleRef: React.RefObject<Subtitle>;

    constructor(props: any) {
        super(props);
        this.progress = 0;
        this.totalTime = 0;
        this.playerRef = React.createRef<Player>();
        this.subtitleRef = React.createRef<Subtitle>();

        this.state = {
            videoFile: undefined,
            subtitleFile: undefined,
            currentSentence: undefined,
        };
    }

    private onFileChange = (file: FileT) => {
        if (FileType.VIDEO === file.fileType) {
            this.setState({
                videoFile: file,
            });
            if (file.fileName !== undefined) {
                document.title = file.fileName;
            }
        }
        if (FileType.SUBTITLE === file.fileType) {
            this.setState({
                subtitleFile: file,
            });
        }
    };

    private onSpace() {
        this.playerRef.current?.change();
    }

    private onJumpTo(position: JumpPosition) {
        if (this.subtitleRef.current === null) {
            console.log('subtitleRef is empty, can not jump');
            return;
        }
        if (JumpPosition.BEFORE === position) {
            this.subtitleRef.current.jumpPrev();
        }
        if (JumpPosition.AFTER === position) {
            this.subtitleRef.current.jumpNext();
        }
        if (JumpPosition.CURRENT === position) {
            this.subtitleRef.current.repeat();
        }
    }

    private seekTo = (time: number) => {
        this.playerRef.current?.seekTo(time);
        this.playerRef.current?.play();
    };

    private showControl = () => {
        console.log('showC');
        this.playerRef.current?.showControl();
    };

    private hideControl = () => {
        console.log('hideControl');
        this.playerRef.current?.hideControl();
    };

    private currentTime = () => this.progress;

    private onCurrentSentenceChange = (current: SentenceT) => {
        this.setState({
            currentSentence: current,
        });
    };

    render() {
        const { videoFile, subtitleFile, currentSentence } = this.state;
        const player = (
            <>
                <Player
                    ref={this.playerRef}
                    videoFile={videoFile}
                    onProgress={(time) => {
                        this.progress = time;
                    }}
                    onTotalTimeChange={(time) => {
                        this.totalTime = time;
                    }}
                />
            </>
        );
        const subtitle = (
            <Subtitle
                ref={this.subtitleRef}
                getCurrentTime={this.currentTime}
                onCurrentSentenceChange={this.onCurrentSentenceChange}
                seekTo={this.seekTo}
                subtitleFile={subtitleFile}
            />
        );
        const mainSubtitle = <MainSubtitle sentence={currentSentence} />;
        return (
            <div className="font-face-arc bg-neutral-800">
                <GlobalShortCut
                    onJumpTo={(position) => this.onJumpTo(position)}
                    onSpace={() => this.onSpace()}
                />
                <RecordProgress
                    getCurrentProgress={() => this.progress}
                    getCurrentVideoFile={() => videoFile}
                />
                <ResizeableSkeleton
                    player={player}
                    currentSentence={mainSubtitle}
                    subtitle={subtitle}
                />

                <UploadPhoto onFileChange={this.onFileChange} />
                <div id="progressBarRef">
                    <BorderProgressBar
                        getCurrentTime={() => this.progress}
                        getTotalTime={() => this.totalTime}
                    />
                </div>
            </div>
        );
    }
}
