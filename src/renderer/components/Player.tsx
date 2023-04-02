import React, { Component, ReactElement } from 'react';
import FileT from '../lib/param/FileT';
import callApi from '../lib/apis/ApiWrapper';

interface PlayerParam {
    videoFile: FileT | undefined;
    onProgress: (time: number) => void;
    onTotalTimeChange: (time: number) => void;
}

interface PlayerState {
    playingState: boolean;
    showControl: boolean;
}

export default class Player extends Component<PlayerParam, PlayerState> {
    private readonly playerRef: React.RefObject<HTMLVideoElement>;

    private lastFile: FileT | undefined;

    constructor(props: PlayerParam | Readonly<PlayerParam>) {
        super(props);
        this.playerRef = React.createRef<HTMLVideoElement>();

        this.state = {
            playingState: true,
            showControl: false,
        };
    }

    componentDidUpdate(prevProps: PlayerParam, prevState: PlayerState) {
        const { state } = this;
        if (prevState.playingState !== state.playingState) {
            const player = this.getPlayer();
            if (player) {
                if (state.playingState) {
                    player.play();
                } else {
                    player.pause();
                }
            }
        }
    }

    public play = () => {
        console.log('play');
        this.setState({ playingState: true });
    };

    showControl = () => {
        this.setState({
            showControl: true,
        });
    };

    private jumpToHistoryProgress = async (file: FileT) => {
        if (file === this.lastFile) {
            return;
        }
        const { videoFile } = this.props;
        if (videoFile === undefined) {
            return;
        }
        const result = await callApi('query-progress', [videoFile.fileName]);
        const progress = result as number;
        this.seekTo(progress);
        this.lastFile = file;
    };

    private getPlayer = () => {
        return this.playerRef.current;
    };

    public pause = () => {
        console.log('pause');
        this.setState({
            playingState: false,
        });
    };

    hideControl = () => {
        this.setState({
            showControl: false,
        });
    };

    public seekTo(time: number) {
        const player = this.getPlayer();
        if (player === null) {
            console.log('player undefined, cannot seekTo');
            return;
        }
        if (time === undefined) {
            console.log('time undefined, cannot seekTo');
            return;
        }
        console.log('seek time>>> ', time);
        player.currentTime = time;
    }

    public change() {
        const { showControl, playingState } = this.state;
        if (showControl) {
            return;
        }
        this.setState({
            playingState: !playingState,
        });
    }

    render(): ReactElement {
        const { videoFile, onProgress, onTotalTimeChange } = this.props;
        const { playingState, showControl } = this.state;
        if (videoFile === undefined) {
            return <></>;
        }
        return (
            <div
                className="w-full h-full mb-auto"
                onDoubleClick={this.showControl}
                onMouseLeave={this.hideControl}
            >
                {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                <video
                    id="react-player-id"
                    ref={this.playerRef}
                    src={videoFile.objectUrl ? videoFile.objectUrl : ''}
                    controls={showControl}
                    style={{ width: '100%', height: '100%' }}
                    autoPlay={playingState}
                    onPlay={() => {
                        if (!playingState) {
                            this.setState({ playingState: true });
                        }
                    }}
                    onPause={() => {
                        if (playingState) {
                            this.setState({ playingState: false });
                        }
                    }}
                    onTimeUpdate={() => {
                        onProgress(this.playerRef.current!.currentTime);
                    }}
                    onLoadedMetadata={() => {
                        onTotalTimeChange(this.playerRef.current!.duration);
                        this.jumpToHistoryProgress(videoFile);
                    }}
                />
            </div>
        );
    }
}
