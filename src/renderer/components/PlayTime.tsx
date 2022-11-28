import { Component } from 'react';
import style from './css/PlayTime.module.css';

interface PlayTimeParam {
    getProgress: () => number;
    getTotalTime: () => number;
}

interface PlayerTimeState {
    totalTime: string;
    progress: string;
}

export default class PlayTime extends Component<
    PlayTimeParam,
    PlayerTimeState
> {
    private interval: NodeJS.Timer | undefined;

    constructor(props: PlayTimeParam | Readonly<PlayTimeParam>) {
        super(props);
        this.state = {
            totalTime: '',
            progress: '',
        };
    }

    componentDidMount() {
        this.interval = setInterval(this.task, 100);
    }

    componentWillUnmount() {
        clearInterval(this.interval);
    }

    private task = () => {
        const { getTotalTime, getProgress } = this.props;
        this.setState({
            totalTime: this.secondToDate(getTotalTime()),
            progress: this.secondToDate(getProgress()),
        });
    };

    private secondToDate = (seconds = 0) => {
        if (seconds === undefined) {
            return '00:00:00';
        }
        const h: number = Math.floor((seconds / 60 / 60) % 24);
        const hs = h < 10 ? `0${h}` : h;
        const m = Math.floor((seconds / 60) % 60);
        const ms = m < 10 ? `0${m}` : m;
        const s = Math.floor(seconds % 60);
        const ss = s < 10 ? `0${s}` : s;
        return `${hs}:${ms}:${ss}`;
    };

    render() {
        const { progress, totalTime } = this.state;
        return (
            <>
                <div className={style.timeContainer}>
                    <div className={style.time}>
                        <span className={style.timeText}>{progress}</span>
                        &nbsp;/&nbsp;
                        <span className={style.timeText}>{totalTime}</span>
                    </div>
                </div>
            </>
        );
    }
}
