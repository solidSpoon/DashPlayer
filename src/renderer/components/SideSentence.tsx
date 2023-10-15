import React from 'react';
import {
    AiOutlinePauseCircle,
    AiOutlinePlayCircle,
    AiOutlineTrademarkCircle,
} from 'react-icons/ai';
import SentenceT from '../lib/param/SentenceT';

interface SideSentenceNewParam {
    sentence: SentenceT;
    onClick: (sentence: SentenceT) => void;
    isCurrent: boolean;
    isRepeat: boolean;
    pause: boolean;
}

export default function SideSentence({
    sentence,
    onClick,
    isCurrent,
    isRepeat,
    pause,
}: SideSentenceNewParam) {
    const show = isCurrent ? 'visible' : 'invisible';
    const s = [sentence.text, sentence.textZH, sentence.msTranslate].find(
        (i) => i !== undefined && i !== ''
    );

    const icon = () => {
        if (pause) {
            return <AiOutlinePlayCircle className="w-full h-full" />;
        }
        return isRepeat ? (
            <AiOutlineTrademarkCircle className="w-full h-full" />
        ) : (
            <AiOutlinePauseCircle className="w-full h-full" />
        );
    };

    return (
        // eslint-disable-next-line jsx-a11y/no-static-element-interactions,jsx-a11y/click-events-have-key-events
        <div
            className="
                m-1.5
                px-1
                py-2
                border-0
                flex
                gap-1
                content-start
                rounded-lg
                bg-sentenceBackground
                hover:bg-sentenceHoverBackground
                hover:drop-shadow-lg
                text-subtitle
                drop-shadow
                "
            onClick={() => {
                onClick(sentence);
            }}
        >
            <div
                className={`w-7 flex flex-col items-center justify-center h-7 text-playIcon ${show}`}
            >
                {icon()}
            </div>

            <div className="w-full text-center">{s ?? ''}</div>
        </div>
    );
}
