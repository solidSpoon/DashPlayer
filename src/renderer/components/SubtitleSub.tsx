import React, { Component, ReactElement } from 'react';
import searchSubtitle from '../lib/searchSubtitle';
import isVisible from '../lib/isVisible';
import SentenceT from '../lib/param/SentenceT';
import SideSentenceNew from './SideSentenceNew';

interface SubtitleSubParam {
    subtitles: SentenceT[];
    getCurrentTime: () => number;
    seekTo: (time: number) => void;
    onCurrentSentenceChange: (currentSentence: SentenceT) => void;
}

interface IntervalParam {
    getCurrentTime: () => number;
    sentences: () => SentenceT[] | undefined;
}

export default class SubtitleSub extends Component<
    SubtitleSubParam,
    SubtitleSubParam
> {
    private timer: NodeJS.Timer | undefined;

    private currentSentence: SentenceT | undefined;

    private currentSentenceUpdateTime: number = Date.now();

    private parentRef: React.RefObject<HTMLDivElement> =
        React.createRef<HTMLDivElement>();

    private intervalParam: IntervalParam = {
        // eslint-disable-next-line react/destructuring-assignment
        getCurrentTime: () => this.props.getCurrentTime(),
        // eslint-disable-next-line react/destructuring-assignment
        sentences: () => this.state.subtitles,
    };

    /**
     * 记得通过重置key来更新
     * https://reactjs.org/blog/2018/06/07/you-probably-dont-need-derived-state.html
     * @param props
     */
    // eslint-disable-next-line react/state-in-constructor
    state = {
        ...this.props,
    };

    componentDidMount() {
        this.timer = setInterval(() => this.interval(this.intervalParam), 50);
    }

    componentWillUnmount() {
        clearInterval(this.timer);
    }

    private getCurrentSentence(): SentenceT {
        const { getCurrentTime } = this.props;
        const { subtitles } = this.state;
        const isOverdue = Date.now() - this.currentSentenceUpdateTime > 600;
        if (isOverdue || this.currentSentence === undefined) {
            const searchRes = searchSubtitle(
                subtitles,
                getCurrentTime(),
                this.currentSentence
            );
            if (searchRes !== undefined) {
                return searchRes;
            }
            return this.currentSentence as SentenceT;
        }
        return this.currentSentence;
    }

    public jumpNext(): void {
        let target = this.getCurrentSentence().getNestItem();
        if (target === undefined) {
            target = this.getCurrentSentence();
        }
        this.jumpTo(target);
    }

    public jumpPrev(): void {
        let target = this.getCurrentSentence().getPrevItem();
        if (target === undefined) {
            target = this.getCurrentSentence();
        }
        this.jumpTo(target);
    }

    public repeat() {
        this.jumpTo(this.getCurrentSentence());
    }

    private jumpTo(sentence: SentenceT) {
        if (sentence === undefined) {
            return;
        }
        const { seekTo } = this.props;
        this.updateTo(sentence);
        this.currentSentenceUpdateTime = Date.now();
        if (sentence.timeStart != null) {
            seekTo(sentence.timeStart);
        }
    }

    private updateTo(sentence: SentenceT) {
        const { onCurrentSentenceChange } = this.props;
        if (
            sentence.divElement?.current === undefined ||
            sentence.divElement?.current === null ||
            sentence === this.currentSentence
        ) {
            console.log(`can not update to, sentence: ${sentence}`);
            return;
        }
        if (sentence.divElement === undefined) {
            console.log(
                `update to failed, sentence.divElement is ${sentence.divElement}`
            );
            return;
        }
        if (!isVisible(sentence.divElement.current)) {
            const offsetTop = sentence.divElement.current?.offsetTop;
            if (offsetTop === undefined) {
                console.log(
                    `update to sentence: ${sentence} failed, offsetTop is ${offsetTop}`
                );
                return;
            }
            const current = this.currentSentence?.divElement?.current;
            if (
                current !== null &&
                current !== undefined &&
                !isVisible(current)
            ) {
                this.parentRef.current?.scrollTo({
                    top: offsetTop - 50,
                });
            } else {
                this.parentRef.current?.scrollTo({
                    top: offsetTop - 50,
                    behavior: 'smooth',
                });
            }
        }
        const { subtitles } = this.state;
        subtitles.forEach((s) => {
            if (sentence.id === s.id) {
                const newSentence: SentenceT = { ...s, isCurrent: false };
                this.currentSentence = newSentence;
                return newSentence;
            }
            if (s.isCurrent) {
                return { ...s, isCurrent: false };
            }
            return s;
        });
        onCurrentSentenceChange(sentence);
    }

    private interval(intervalParam: IntervalParam) {
        console.log('interval');
        if (intervalParam.sentences() === undefined) {
            return;
        }
        const find: SentenceT = this.getCurrentSentence();
        if (find === this.currentSentence) {
            return;
        }
        this.updateTo(find);
    }

    private subtitleItems(): ReactElement[] {
        const { subtitles } = this.props;
        return subtitles.map((item) => {
            const divRef = React.createRef<HTMLDivElement>();
            item.divElement = divRef;
            return (
                <div key={item.id} ref={divRef}>
                    <SideSentenceNew
                        key={item.id}
                        sentence={item}
                        onClick={(sentence) => this.jumpTo(sentence)}
                        isCurrent={item.isCurrent}
                    />
                </div>
            );
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
