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

    private readonly playerRefBackground: React.RefObject<HTMLVideoElement>;

    private lastFile: FileT | undefined;

    private animationFrameId: number | undefined;

    constructor(props: PlayerParam | Readonly<PlayerParam>) {
        super(props);
        this.playerRef = React.createRef<HTMLVideoElement>();
        this.playerRefBackground = React.createRef<HTMLVideoElement>();
        this.state = {
            playingState: true,
            showControl: false,
        };
    }

    componentDidMount() {
        this.syncVideos();
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

    componentWillUnmount() {
        if (this.animationFrameId !== undefined) {
            cancelAnimationFrame(this.animationFrameId);
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

    syncVideos = async () => {
        const mainVideo = this.playerRef.current;
        const backgroundVideo = this.playerRefBackground.current;

        if (mainVideo && backgroundVideo) {
            backgroundVideo.currentTime = mainVideo.currentTime + 0.05;
            const { state } = this;
            if (state.playingState) {
                try {
                    await backgroundVideo.play();
                } catch (error) {
                    console.error('Error playing background video:', error);
                }
            } else {
                backgroundVideo.pause();
            }
        }

        // 在每一帧中调用 syncVideos
        this.animationFrameId = requestAnimationFrame(this.syncVideos);
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
                className="w-full h-full mb-auto relative overflow-hidden"
                onDoubleClick={this.showControl}
                onMouseLeave={this.hideControl}
            >
                <div className="absolute top-0 left-0 w-full h-full">
                    {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
                    <video
                        className="w-full h-full"
                        ref={this.playerRefBackground}
                        src={videoFile.objectUrl ? videoFile.objectUrl : ''}
                        style={{
                            filter: 'blur(100px)',
                            // transform: 'scale(1.1)',
                            objectFit: 'cover',
                        }}
                        muted
                    />
                </div>
                <div className="absolute top-0 left-0 w-full h-full">
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
            </div>
        );
    }
}
