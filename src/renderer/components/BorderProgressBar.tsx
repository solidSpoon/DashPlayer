import ProgressBar from '@ramonak/react-progress-bar';
import { Component } from 'react';
import { visible, white } from 'chalk';
import PlayTime from './PlayTime';

interface BorderProgressBarParam {
    hasSubTitle: boolean;
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

    private timeout: (number | undefined)[] = [];

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

    private mouseEnter = () => {
        while (this.timeout.length > 0) {
            const id = this.timeout.pop();
            window.clearTimeout(id);
        }
        const func = () => this.setState({ isHover: true });
        this.timeout.push(window.setTimeout(func, 400));
    };

    private mouseLeave = () => {
        while (this.timeout.length > 0) {
            const id = this.timeout.pop();
            window.clearTimeout(id);
        }
        const func = () => this.setState({ isHover: false });
        this.timeout.push(window.setTimeout(func, 300));
    };

    render() {
        const { completed, isHover } = this.state;
        const { getTotalTime, getCurrentTime, hasSubTitle } = this.props;
        return (
            <>
                <div className="w-full h-2 bg-stone-200" />
                <div
                    className={`w-full flex flex-col-reverse
                items-end absolute bottom-0 h-10 mt-60
                 ${isHover ? 'bg-stone-200' : ''}`}
                    onMouseEnter={this.mouseEnter}
                    onMouseLeave={this.mouseLeave}
                >
                    <div className="w-full z-50">
                        <ProgressBar
                            baseBgColor="rgb(231 229 228)"
                            completed={completed}
                            transitionDuration="0.2s"
                            isLabelVisible={false}
                            height="8px"
                            width="100%"
                            borderRadius={`${
                                hasSubTitle ? '0 8px 8px 0' : '0'
                            }`}
                        />
                    </div>
                    <div
                        className={`mr-5 ${isHover ? 'visible' : 'invisible'}`}
                    >
                        <PlayTime
                            getProgress={getCurrentTime}
                            getTotalTime={getTotalTime}
                        />
                    </div>
                    {hasSubTitle && (
                        <div
                            className={`absolute bottom-0 right-0 w-1 h-1 bg-stone-200 -translate-x-2
                        ${isHover ? '-translate-y-10' : '-translate-y-2'}`}
                        >
                            <div className="w-full h-full rounded-br-full bg-neutral-800" />
                        </div>
                    )}
                </div>
            </>
        );
    }
}
