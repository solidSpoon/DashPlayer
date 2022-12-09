import React, { PureComponent } from 'react';
import axios from 'axios';
import SentenceT from '../lib/param/SentenceT';
import FileT from '../lib/param/FileT';
import parseSrtSubtitles from '../lib/parseSrt';
import TransFiller from '../lib/TransFiller';
import SubtitleSub from './SubtitleSub';
import callApi from '../lib/apis/ApiWrapper';
import TranslateBuf from '../lib/TranslateBuf';

interface SubtitleParam {
    subtitleFile: FileT | undefined;
    getCurrentTime: () => number;
    seekTo: (time: number) => void;
    onCurrentSentenceChange: (currentSentence: SentenceT) => void;
}

interface SubtitleState {
    subtitles: SentenceT[] | undefined;
}

export default class Subtitle extends PureComponent<
    SubtitleParam,
    SubtitleState
> {
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
        });
        srtSubtitles.forEach((item) => {
            item.updateKey();
        });
        // new TransFiller(srtSubtitles, u).translate();
        this.setState({
            subtitles: srtSubtitles,
        });
        this.trans(srtSubtitles, fileUrl.objectUrl ?? '');
    };

    private trans = async (arr: SentenceT[], url: string) => {
        let tempArr = arr;
        const buffers: TranslateBuf[] = TransFiller.splitToBuffers(arr, 1000);
        // eslint-disable-next-line no-restricted-syntax
        for (const buffer of buffers) {
            if (buffer.isEmpty()) {
                return;
            }
            // eslint-disable-next-line no-await-in-loop
            buffer.response = (await callApi('batch-translate', [
                buffer.strs,
            ])) as string[];
            const translatedArray = this.getTranslatedArray(tempArr, buffer);
            translatedArray.forEach((item) => {
                item.updateKey();
            });
            // eslint-disable-next-line no-restricted-syntax
            for (const item of translatedArray) {
                if (item.fileUrl !== url) {
                    return;
                }
            }
            this.setState({ subtitles: translatedArray });
            tempArr = translatedArray;
            // eslint-disable-next-line no-await-in-loop
            await TransFiller.sleep(300);
        }
    };

    private getTranslatedArray = (
        arr: SentenceT[],
        buffer: TranslateBuf
    ): SentenceT[] => {
        const newArr: SentenceT[] = [...arr];
        const { response } = buffer;
        if (response === undefined) {
            return newArr;
        }
        response.forEach((item, i) => {
            const index = buffer.startIndex + i;
            if (index < newArr.length) {
                const n: SentenceT = arr[index].copy();
                n.msTranslate = item;
                newArr[index] = n;
            }
        });
        return newArr;
    };

    jumpPrev() {
        this.ref.current?.jumpPrev();
    }

    jumpNext() {
        this.ref.current?.jumpNext();
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
