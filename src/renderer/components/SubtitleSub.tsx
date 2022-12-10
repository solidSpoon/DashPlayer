import React, { Component, ReactElement } from 'react';
import isVisible, {
    getTargetBottomPosition,
    isBottomInVisible,
    isTopInVisible,
} from '../lib/isVisible';
import SentenceT from '../lib/param/SentenceT';
import SideSentenceNew from './SideSentenceNew';

interface SubtitleSubParam {
    subtitles: SentenceT[];
    getCurrentTime: () => number;
    seekTo: (time: number) => void;
    onCurrentSentenceChange: (currentSentence: SentenceT) => void;
}
interface SubtitleSubState {
    current: SentenceT | undefined;
}

export default class SubtitleSub extends Component<
    SubtitleSubParam,
    SubtitleSubState
> {
    private readonly SCROOL_BOUNDARY = 100;

    private timer: NodeJS.Timer | undefined;

    private currentSentence: SentenceT | undefined;

    private manuallyUpdateTime: number = Date.now();

    private parentRef: React.RefObject<HTMLDivElement> = React.createRef();

    private currentRef: React.RefObject<HTMLDivElement> = React.createRef();

    constructor(props: SubtitleSubParam) {
        super(props);
        this.state = {
            current: undefined,
        };
    }

    componentDidMount() {
        this.timer = setInterval(this.interval, 50);
    }

    componentDidUpdate(
        prevProps: Readonly<SubtitleSubParam>,
        prevState: Readonly<SubtitleSubState>,
        snapshot?: any
    ) {
        const [beforeTopHidden, beforeBottomHidden] = snapshot as [
            boolean,
            boolean
        ];
        const currentDiv = this.currentRef.current;
        if (
            currentDiv === null ||
            isVisible(currentDiv, this.SCROOL_BOUNDARY)
        ) {
            return;
        }
        const [currentTopHidden, currentBottomHidden] = [
            isTopInVisible(currentDiv, this.SCROOL_BOUNDARY),
            isBottomInVisible(currentDiv, this.SCROOL_BOUNDARY),
        ];

        const { offsetTop } = currentDiv;
        if (currentTopHidden && beforeTopHidden) {
            this.parentRef.current?.scrollTo({
                top: offsetTop - this.SCROOL_BOUNDARY,
            });
        } else if (currentBottomHidden && beforeBottomHidden) {
            this.parentRef.current?.scrollTo({
                top:
                    offsetTop -
                    getTargetBottomPosition(currentDiv, this.SCROOL_BOUNDARY),
            });
        } else if (currentTopHidden || currentBottomHidden) {
            this.parentRef.current?.scrollTo({
                top: offsetTop - this.SCROOL_BOUNDARY,
                behavior: 'smooth',
            });
        }
    }

    componentWillUnmount() {
        clearInterval(this.timer);
    }

    getSnapshotBeforeUpdate(): [boolean, boolean] {
        const ele = this.currentRef.current;
        if (ele === null) {
            return [false, false];
        }
        return [
            isTopInVisible(ele, this.SCROOL_BOUNDARY),
            isBottomInVisible(ele, this.SCROOL_BOUNDARY),
        ];
    }

    private getElementAt(index: number): SentenceT {
        const { subtitles } = this.props;
        let targetIndex = index;
        if (targetIndex < 0) {
            targetIndex = 0;
        }
        if (targetIndex >= subtitles.length) {
            targetIndex = subtitles.length - 1;
        }
        return subtitles[targetIndex];
    }

    private findCurrentSentence = (
        subtitles: SentenceT[],
        currentTime: number
    ): SentenceT => {
        return (
            subtitles.find((item) => item.isCurrent(currentTime)) ??
            subtitles[subtitles.length - 1]
        );
    };

    private getCurrentSentence = (): SentenceT => {
        const { getCurrentTime, subtitles } = this.props;
        const isOverdue = Date.now() - this.manuallyUpdateTime > 600;
        if (
            this.currentSentence === undefined ||
            !this.currentSentence.equals(
                subtitles[this.currentSentence.index]
            ) ||
            isOverdue
        ) {
            return this.findCurrentSentence(subtitles, getCurrentTime());
        }
        return this.currentSentence;
    };

    public jumpTo = (target: SentenceT) => {
        const { seekTo } = this.props;
        this.updateTo(target);
        this.manuallyUpdateTime = Date.now();
        seekTo(target.currentBegin ?? 0);
    };

    private interval = () => {
        const find: SentenceT = this.getCurrentSentence();
        if (find === undefined) {
            return;
        }
        this.updateTo(find);
    };

    private updateTo(target: SentenceT) {
        if (target.equals(this.currentSentence)) {
            return;
        }
        this.currentSentence = target;
        const { onCurrentSentenceChange } = this.props;
        onCurrentSentenceChange(target);
        this.setState({ current: target });
    }

    public repeat() {
        const sentence = this.getCurrentSentence();
        this.jumpTo(sentence);
    }

    public jumpNext(): void {
        const sentence = this.getCurrentSentence();
        const targetElement = this.getElementAt(sentence.index + 1);
        this.jumpTo(targetElement);
    }

    public jumpPrev(): void {
        const sentence = this.getCurrentSentence();
        const targetElement = this.getElementAt(sentence.index - 1);
        this.jumpTo(targetElement);
    }

    private subtitleItems(): ReactElement[] {
        const { subtitles } = this.props;
        const { current } = this.state;
        return subtitles.map((item) => {
            const isCurrent = item.equals(current);
            let result = (
                <SideSentenceNew
                    key={item.getKey()}
                    sentence={item}
                    onClick={(sentence) => this.jumpTo(sentence)}
                    isCurrent={isCurrent}
                />
            );
            if (isCurrent) {
                result = (
                    <div key={`${item.getKey()}div`} ref={this.currentRef}>
                        {result}
                    </div>
                );
            }
            return result;
        });
    }

    render() {
        console.log('Subtitle render');
        return (
            <div
                className="flex flex-col w-full h-full overflow-x-hidden overflow-y-auto"
                ref={this.parentRef}
            >
                <div className="w-full mt-3" />
                {this.subtitleItems()}
                <div className="w-full mb-96" />
            </div>
        );
    }
}
