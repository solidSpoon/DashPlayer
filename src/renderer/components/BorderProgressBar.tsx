import ProgressBar from '@ramonak/react-progress-bar';
import { Component } from 'react';
import { visible } from 'chalk';
import PlayTime from './PlayTime';

interface BorderProgressBarParam {
    getCurrentTime: () => number;
    getTotalTime: () => number;
}

interface BorderProgressBarState {
    completed: number;
    isHover: boolean;
}

export default class BorderProgressBar extends Component<
    BorderProgressBarParam,
    BorderProgressBarState
> {
    private interval: NodeJS.Timer | undefined;

    constructor(
        props: BorderProgressBarParam | Readonly<BorderProgressBarParam>
    ) {
        super(props);
        this.state = {
            completed: 100,
            isHover: false,
        };
    }

    componentDidMount() {
        this.interval = setInterval(this.intervalTask, 100);
    }

    componentWillUnmount() {
        clearInterval(this.interval);
    }

    private intervalTask = (): void => {
        const { getCurrentTime, getTotalTime } = this.props;
        const currentTime = getCurrentTime();
        const totalTime = getTotalTime();
        if (currentTime === undefined || totalTime === undefined) {
            return;
        }
        this.setState({
            completed: (currentTime / totalTime) * 100,
        });
    };

    render() {
        const { completed, isHover } = this.state;
        const { getTotalTime, getCurrentTime } = this.props;
        const vis = isHover ? 'visible' : 'invisible';
        return (
            <div
                className="w-full flex flex-col-reverse items-end absolute bottom-0 h-10 hover:bg-stone-200 mt-60 delay-500"
                onMouseOver={() => this.setState({ isHover: true })}
                onMouseLeave={() => this.setState({ isHover: false })}
            >
                <div className="w-full">
                    <ProgressBar
                        completed={completed}
                        transitionDuration="0.2s"
                        isLabelVisible={false}
                        height="8px"
                        width="100%"
                        borderRadius="0"
                    />
                </div>
                <div className={`mr-5 ${vis}`}>
                    <PlayTime
                        getProgress={getCurrentTime}
                        getTotalTime={getTotalTime}
                    />
                </div>
            </div>
        );
    }
}
