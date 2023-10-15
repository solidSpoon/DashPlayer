import ProgressBar from '@ramonak/react-progress-bar';
import { Component } from 'react';
import { visible, white } from 'chalk';
// import colors from 'tailwindcss/colors';
import theme from 'tailwindcss/defaultTheme';
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
        this.timeout.push(window.setTimeout(func, 50));
    };

    private mouseLeave = () => {
        while (this.timeout.length > 0) {
            const id = this.timeout.pop();
            window.clearTimeout(id);
        }
        const func = () => this.setState({ isHover: false });
        this.timeout.push(window.setTimeout(func, 10000));
    };

    render() {
        const { completed, isHover } = this.state;
        const { getTotalTime, getCurrentTime, hasSubTitle } = this.props;
        return (
            <>
                <div className="w-full h-2 bg-stone-200" />
                <div
                    className={`w-full flex flex-col-reverse
                items-end absolute bottom-0 h-10 mt-60 pointer-events-none`}
                >
                    <div
                        className="w-full z-50 pointer-events-auto bg-scrollbarTrack"
                        onMouseEnter={this.mouseEnter}
                        onMouseLeave={this.mouseLeave}
                    >
                        <ProgressBar
                            baseBgColor="rgb(var(--colors-scrollbarTrack))"
                            bgColor="rgb(var(--colors-progressbarComplete))"
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
                    <div className="flex flex-row-reverse items-end justify-end">
                        <div
                            className={`w-2 h-full pointer-events-none ${
                                isHover && !hasSubTitle
                                    ? 'bg-scrollbarTrack'
                                    : ''
                            }`}
                        />
                        <div
                            className={`   pointer-events-auto rounded-tl-lg ${
                                isHover ? 'bg-scrollbarTrack' : ''
                            }`}
                            onMouseEnter={this.mouseEnter}
                            onMouseLeave={this.mouseLeave}
                        >
                            <div
                                className={` m-2 mb-1 mr-1 p-1.5 rounded flex justify-center items-center h-6 font-mono
                            ${
                                isHover
                                    ? 'bg-background shadow-inner'
                                    : ''
                            }`}
                            >
                                <PlayTime
                                    textClassName={`${
                                        isHover
                                            ? 'text-textColor'
                                            : 'text-transparent'
                                    }`}
                                    getProgress={getCurrentTime}
                                    getTotalTime={getTotalTime}
                                />
                            </div>
                        </div>
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 1 1"
                            className="w-1.5 h-1.5 -rotate-90 fill-scrollbarTrack"
                            visibility={isHover ? 'visible' : 'hidden'}
                        >
                            <path d="M 0 0 L 0 1 L 1 1 C 0 1 0 0 0 0 Z" />
                        </svg>
                    </div>
                    {hasSubTitle && (
                        <svg
                            xmlns="http://www.w3.org/2000/svg"
                            viewBox="0 0 1 1"
                            className={`absolute bottom-0 right-0 w-1 h-1 fill-scrollbarTrack -translate-x-2 -rotate-90
                            ${isHover ? '-translate-y-11' : '-translate-y-2'}`}
                        >
                            <path d="M 0 0 L 0 1 L 1 1 C 0 1 0 0 0 0 Z" />
                        </svg>
                    )}
                </div>
            </>
        );
    }
}
