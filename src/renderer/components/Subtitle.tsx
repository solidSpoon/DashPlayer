import React, { Component, ReactElement } from 'react';
import axios from 'axios';
import style from './css/Subtitle.module.css';
import searchSubtitle from '../lib/searchSubtitle';
import SentenceT from '../lib/param/SentenceT';
import FileT from '../lib/param/FileT';
import parseSrtSubtitles from '../lib/parseSrt';
import TransFiller from '../lib/TransFiller';
import SideSentence from './SideSentence';
import isVisible from '../lib/isVisible';

interface SubtitleParam {
    subtitleFile: FileT;
    getCurrentTime: () => number;
    seekTo: (time: number) => void;
    onCurrentSentenceChange: (currentSentence: SentenceT) => void;
}

interface SubtitleState {
    subtitles: SentenceT[] | undefined;
}

interface IntervalParam {
    getCurrentTime: () => number;
    sentences: () => SentenceT[] | undefined;
}

export default class Subtitle extends Component<SubtitleParam, SubtitleState> {
    private timer: NodeJS.Timer | undefined;

    private currentSentence: SentenceT | undefined;

    private currentSentenceUpdateTime: number;

    private parentRef: React.RefObject<HTMLDivElement>;

    private intervalParam: IntervalParam = {
        // eslint-disable-next-line react/destructuring-assignment
        getCurrentTime: () => this.props.getCurrentTime(),
        // eslint-disable-next-line react/destructuring-assignment
        sentences: () => this.state.subtitles,
    };

    constructor(props: SubtitleParam | Readonly<SubtitleParam>) {
        super(props);
        this.state = {
            subtitles: undefined,
        };
        this.currentSentence = undefined;
        this.currentSentenceUpdateTime = Date.now();
        this.parentRef = React.createRef<HTMLDivElement>();
    }

    componentDidMount() {
        this.initSubtitles();
        this.timer = setInterval(() => this.interval(this.intervalParam), 50);
    }

    componentDidUpdate(prevProps: SubtitleParam) {
        const { subtitleFile } = this.props;
        const { subtitles } = this.state;
        if (prevProps.subtitleFile === subtitleFile) {
            subtitles?.forEach((item) => {
                item.element?.current?.hide();
            });
            return;
        }
        this.initSubtitles();
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

    private updateSubtitle = (str: string, fileUrl: FileT): void => {
        const srtSubtitles = parseSrtSubtitles(str);
        srtSubtitles.forEach((item) => {
            item.fileUrl = fileUrl.objectUrl;
        });
        let lastSubtitle: SentenceT;
        srtSubtitles.forEach((item) => {
            if (lastSubtitle !== undefined) {
                lastSubtitle.nextItem = item;
                item.prevItem = lastSubtitle;
            }
            lastSubtitle = item;
        });
        new TransFiller(srtSubtitles).fillTranslate();
        this.setState({
            subtitles: srtSubtitles,
        });
    };

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
            this.parentRef.current?.scrollTo({
                top: offsetTop - 50,
                behavior: 'smooth',
            });
        }

        sentence?.element?.current?.show();
        this.currentSentence?.element?.current?.hide();

        this.currentSentence = sentence;
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

    private initSubtitles() {
        const { subtitleFile } = this.props;
        const srcFile = subtitleFile;
        if (srcFile === undefined) {
            console.log('src file is undefined');
            return;
        }
        const { updateSubtitle } = this;
        if (srcFile.objectUrl === undefined) {
            console.log(`can not request src file, srcFile: ${srcFile}`);
            return;
        }
        axios
            .get(srcFile.objectUrl)
            .then((response) => updateSubtitle(response.data, srcFile))
            .catch((error) => console.log(error));
    }

    private subtitleItems(): ReactElement[] {
        const { subtitles } = this.state;
        const sentences = subtitles;
        if (sentences === undefined) {
            return [];
        }
        return sentences.map((item, index) => {
            const ref = React.createRef<SideSentence>();
            item.element = ref;
            const divRef = React.createRef<HTMLDivElement>();
            item.divElement = divRef;
            const keyStr = `sentence-${index}`;
            return (
                <div key={keyStr} ref={divRef}>
                    <SideSentence
                        ref={ref}
                        sentence={item}
                        onClick={(sentence) => this.jumpTo(sentence)}
                        itemKey={index.toString()}
                    />
                </div>
            );
        });
    }

    render() {
        console.log('Subtitle render');
        return (
            <div className={style.subtitleBox} ref={this.parentRef}>
                {this.subtitleItems()}
            </div>
        );
    }
}
