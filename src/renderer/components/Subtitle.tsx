import React, { Component } from 'react';
import axios from 'axios';
import SentenceT from '../lib/param/SentenceT';
import FileT from '../lib/param/FileT';
import parseSrtSubtitles from '../lib/parseSrt';
import TransFiller from '../lib/TransFiller';
import SubtitleSub from './SubtitleSub';

interface SubtitleParam {
    subtitleFile: FileT | undefined;
    getCurrentTime: () => number;
    seekTo: (time: number) => void;
    onCurrentSentenceChange: (currentSentence: SentenceT) => void;
}

interface SubtitleState {
    subtitles: SentenceT[] | undefined;
}

export default class Subtitle extends Component<SubtitleParam, SubtitleState> {
    private ref = React.createRef<SubtitleSub>();

    constructor(props: SubtitleParam | Readonly<SubtitleParam>) {
        super(props);
        this.state = {
            subtitles: undefined,
        };
    }

    componentDidMount() {
        this.initSubtitles();
    }

    componentDidUpdate(prevProps: SubtitleParam) {
        const { subtitleFile } = this.props;
        if (prevProps.subtitleFile === subtitleFile) {
            return;
        }
        this.initSubtitles();
    }

    private updateSubtitle = (str: string, fileUrl: FileT): void => {
        const srtSubtitles = parseSrtSubtitles(str);
        srtSubtitles.forEach((item) => {
            item.fileUrl = fileUrl.objectUrl;
            console.log(item);
        });
        // new TransFiller(srtSubtitles, u).translate();
        this.setState({
            subtitles: srtSubtitles,
        });
    };

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

    jumpPrev() {
        this.ref.current?.jumpPrev();
    }

    jumpNext() {
        this.ref.current?.jumpNext();
    }

    repeat() {
        this.ref.current?.repeat();
    }

    render() {
        console.log('Subtitle out render');
        const { subtitles } = this.state;
        const { getCurrentTime, seekTo, onCurrentSentenceChange } = this.props;
        if (subtitles === undefined) {
            return <></>;
        }
        return (
            <SubtitleSub
                ref={this.ref}
                subtitles={subtitles}
                getCurrentTime={getCurrentTime}
                seekTo={seekTo}
                onCurrentSentenceChange={onCurrentSentenceChange}
            />
        );
    }
}
