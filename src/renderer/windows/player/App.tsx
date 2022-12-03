import React, { Component } from 'react';
import './App.css';
import Resizable from 'react-resizable-layout';
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

    /**
     * 主字幕组件引用
     * @private
     */
    private mainSubtitleRef: React.RefObject<MainSubtitle>;

    constructor(props: any) {
        super(props);
        this.progress = 0;
        this.totalTime = 0;
        this.playerRef = React.createRef<Player>();
        this.subtitleRef = React.createRef<Subtitle>();
        this.mainSubtitleRef = React.createRef<MainSubtitle>();

        this.state = {
            videoFile: undefined,
            subtitleFile: undefined,
        };
    }

    private onFileChange = (file: FileT) => {
        if (FileType.VIDEO === file.fileType) {
            this.setState({
                videoFile: file,
            });
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

    private changeCurrentSentence(currentSentence: SentenceT) {
        if (this.mainSubtitleRef === undefined) {
            return;
        }
        this.mainSubtitleRef.current?.setState({
            sentence: currentSentence,
        });
    }

    render() {
        const { videoFile, subtitleFile } = this.state;
        return (
            <div className="flex bg-blue-500 h-screen">
                <div className="bg-green-600 w-2/3">
                    <div className="bg-emerald-700 h-2/3" />
                    <div className="bg-emerald-200 flex-1" />
                </div>
                <div className="bg-gray-400 flex-1">b</div>
            </div>
        );
    }
}
