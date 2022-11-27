import ReactPlayer from "react-player";
import React, { Component, ReactElement } from "react";
import axios from "axios";
import style from "./css/Player.module.css";
import FileT from "../lib/param/FileT";

interface PlayerParam {
    videoFile: FileT;
    onProgress: (time: number) => void;
    onTotalTimeChange: (time: number) => void;
}

interface PlayerState {
    playing: boolean;
    showControl: boolean;
}

export default class Player extends Component<PlayerParam, PlayerState> {
    private readonly playerRef: React.RefObject<ReactPlayer>;

    private playing: boolean;

    private lastFile: FileT | undefined;

    constructor(props: PlayerParam | Readonly<PlayerParam>) {
        super(props);
        this.playerRef = React.createRef<ReactPlayer>();
        this.playing = true;
        this.state = {
            playing: true,
            showControl: false
        };
    }

    private jumpToHistoryProgress = (file: FileT) => {
        console.log("onready", file.fileName);
        if (file === this.lastFile) {
            return;
        }
        console.log("isready");
        const { videoFile } = this.props;
        // axios
        //   .get('/api/queryProgress', {
        //     params: {
        //       fileName: videoFile.fileName,
        //     },
        //   })
        //   .then((response) => {
        //     this.seekTo(response.data.progress);
        //     return response;
        //   })
        //   .catch((err) => console.log(err));
        window.electron.ipcRenderer.sendMessage("query-progress", [videoFile.fileName]);
        window.electron.ipcRenderer.once("query-progress", (args) => {
            const progress = args as number;
            console.log("query progress ", progress);
            this.seekTo(progress);
        });
        this.lastFile = file;
    };

    private getPlayer = () => {
        return this.playerRef.current;
    };

    public pause() {
        this.setState({
            playing: false
        });
    }

    public change() {
        const { playing } = this.state;
        this.setState({
            playing: !playing
        });
    }

    public play() {
        this.setState({
            playing: true
        });
    }

    public seekTo(time: number) {
        const player = this.getPlayer();
        if (player === null) {
            console.log("player undefined, cannot seekTo");
            return;
        }
        if (time === undefined) {
            console.log("time undefined, cannot seekTo");
            return;
        }
        console.log("seek time>>> ", time);
        player.seekTo(time, "seconds");
    }

    showControl() {
        this.setState({
            showControl: true
        });
    }

    hideControl() {
        this.setState({
            showControl: false
        });
    }

    render(): ReactElement {
        const { videoFile, onProgress, onTotalTimeChange } = this.props;
        const { playing, showControl } = this.state;
        if (videoFile === undefined) {
            return <></>;
        }
        return (
            <ReactPlayer
                id="react-player-id"
                ref={this.playerRef}
                url={videoFile.objectUrl ? videoFile.objectUrl : ""}
                className={`react-player${style.player}`}
                playing={playing}
                controls={false}
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
            />
        );
    }
}
