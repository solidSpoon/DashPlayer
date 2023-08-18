import React, { PureComponent, useEffect, useState } from 'react';
import axios from 'axios';
import SentenceT from '../lib/param/SentenceT';
import FileT from '../lib/param/FileT';
import parseSrtSubtitles from '../lib/parseSrt';
import TransFiller from '../lib/TransFiller';
import SubtitleSub from './SubtitleSub';
import callApi from '../lib/apis/ApiWrapper';
import TranslateBuf from '../lib/TranslateBuf';
import useSubtitle from '../hooks/useSubtitle';

interface SubtitleParam {
    subtitles: SentenceT[];
    getCurrentTime: () => number;
    seekTo: (time: number) => void;
    onCurrentSentenceChange: (currentSentence: SentenceT) => void;
}

export default function Subtitle({
    subtitles,
    getCurrentTime,
    seekTo,
    onCurrentSentenceChange,
}: SubtitleParam): React.ReactElement {
    const render = () => {
        console.log('Subtitle out render');
        if (subtitles === undefined) {
            return <></>;
        }
        return (
            <SubtitleSub
                subtitles={subtitles}
                getCurrentTime={getCurrentTime}
                seekTo={seekTo}
                onCurrentSentenceChange={onCurrentSentenceChange}
            />
        );
    };

    return render();
}
