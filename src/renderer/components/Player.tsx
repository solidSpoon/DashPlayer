import ReactPlayer from 'react-player';
import React, { Component, PureComponent, ReactElement } from 'react';
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
    private readonly playerRef: React.RefObject<ReactPlayer>;

    private lastFile: FileT | undefined;

    constructor(props: PlayerParam | Readonly<PlayerParam>) {
        super(props);
        this.playerRef = React.createRef<ReactPlayer>();

        this.state = {
            playingState: true,
            showControl: false,
        };
    }

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
        this.setState({
            playingState: false,
        });
    };

    public play = () => {
        this.setState({ playingState: true });
    };

    showControl = () => {
        this.setState({
            showControl: true,
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
        player.seekTo(time, 'seconds');
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
                onClick={this.showControl}
                onMouseLeave={this.hideControl}
            >
                <ReactPlayer
                    id="react-player-id"
                    ref={this.playerRef}
                    url={videoFile.objectUrl ? videoFile.objectUrl : ''}
                    playing={playingState}
                    controls={showControl}
                    width="100%"
                    height="100%"
                    progressInterval={50}
                    onProgress={(progress) => {
                        onProgress(progress.playedSeconds);
                    }}
                    onDuration={(duration) => {
                        onTotalTimeChange(duration);
                    }}
                    onReady={() => this.jumpToHistoryProgress(videoFile)}
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
                />
            </div>
        );
    }
}
