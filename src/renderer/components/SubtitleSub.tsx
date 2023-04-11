import React, { Component } from 'react';
import { Virtuoso, VirtuosoHandle } from 'react-virtuoso';
import isVisible from '../lib/isVisible';
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
    private readonly SCROOL_BOUNDARY = 50;

    private timer: NodeJS.Timer | undefined;

    private currentSentence: SentenceT | undefined;

    private manuallyUpdateTime: number = Date.now();

    private currentRef: React.RefObject<HTMLDivElement> = React.createRef();

    private listRef: React.RefObject<VirtuosoHandle> = React.createRef();

    private visibleRange: [number, number] = [0, 0];

    constructor(props: SubtitleSubParam) {
        super(props);
        this.state = {
            current: undefined,
        };
    }

    componentDidMount() {
        this.timer = setInterval(this.interval, 50);
    }

    componentDidUpdate = (
        prevProps: Readonly<SubtitleSubParam>,
        prevState: Readonly<SubtitleSubState>,
        snapshot?: any
    ) => {
        // 似乎 render() 最外层元素渲染后就会触发 componentDidUpdate，此时还拿不到新的元素
        // 所以需要延迟一下
        requestAnimationFrame(() => {
            const beforeVisable = snapshot as boolean;
            if (
                this.currentRef.current === null &&
                this.currentSentence === undefined
            ) {
                return;
            }
            const currentVisable = this.isIsVisible();
            const index = this.currentSentence?.index;
            if (index && !currentVisable) {
                if (beforeVisable) {
                    this.listRef.current?.scrollToIndex({
                        index: index - 1 >= 0 ? index - 1 : 0,
                        align: 'start',
                        behavior: 'smooth',
                    });
                } else {
                    this.listRef.current?.scrollIntoView({
                        index,
                        align: 'start',
                        behavior: 'auto',
                    });
                    this.listRef.current?.scrollIntoView({
                        index: index - 1 >= 0 ? index - 1 : 0,
                        align: 'start',
                        behavior: 'auto',
                    });
                }
            }
        });
    };

    componentWillUnmount() {
        clearInterval(this.timer);
    }

    getSnapshotBeforeUpdate(): boolean {
        return this.isIsVisible();
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

    private isIsVisible = (): boolean => {
        const index = this.currentSentence?.index;
        if (index) {
            if (index < this.visibleRange[0] || index > this.visibleRange[1]) {
                return false;
            }
        }
        const currentDiv = this.currentRef.current;
        if (currentDiv === null) {
            return false;
        }
        return isVisible(currentDiv, this.SCROOL_BOUNDARY);
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

    render() {
        const { subtitles } = this.props;
        const { current } = this.state;
        return (
            <Virtuoso
                ref={this.listRef}
                className="h-full w-full"
                data={subtitles}
                rangeChanged={({ startIndex, endIndex }) => {
                    this.visibleRange = [startIndex, endIndex];
                }}
                itemContent={(index, item) => {
                    const isCurrent = item.equals(current);
                    let result = (
                        <SideSentenceNew
                            sentence={item}
                            onClick={(sentence) => this.jumpTo(sentence)}
                            isCurrent={isCurrent}
                        />
                    );
                    if (isCurrent) {
                        result = (
                            <div
                                key={`${item.getKey()}div`}
                                ref={this.currentRef}
                            >
                                {result}
                            </div>
                        );
                    }
                    return result;
                }}
            />
        );
    }
}
