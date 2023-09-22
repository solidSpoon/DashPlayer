import React from 'react';
// eslint-disable-next-line import/no-cycle
import SentenceT from '../lib/param/SentenceT';

interface SideSentenceNewParam {
    sentence: SentenceT;
    onClick: (sentence: SentenceT) => void;
    isCurrent: boolean;
}

export default function SideSentenceNew({
    sentence,
    onClick,
    isCurrent,
}: SideSentenceNewParam) {
    const show = isCurrent ? 'visible' : 'invisible';
    const s = [sentence.text, sentence.textZH, sentence.msTranslate].find(
        (i) => i !== undefined && i !== ''
    );
    return (
        // eslint-disable-next-line jsx-a11y/no-static-element-interactions,jsx-a11y/click-events-have-key-events
        <div
            className="
                m-1.5
                py-2
                border-0
                flex
                content-start
                rounded-lg
                bg-neutral-700
                hover:shadow-inner
                hover:shadow-neutral-500
                hover:bg-neutral-600
                hover:drop-shadow-lg
                text-lg
                drop-shadow
                "
            onClick={() => {
                onClick(sentence);
            }}
        >
            <div
                className={`flex flex-row justify-center justify-items-start w-10 ${show}`}
            >
                <svg
                    className="icon w-3/4 h-min"
                    viewBox="0 0 1024 1024"
                    version="1.1"
                    xmlns="http://www.w3.org/2000/svg"
                    p-id="3451"
                >
                    <path
                        d="M684.07 452.22h-0.01l-209.4-120.91c-23.38-13.48-51.27-13.49-74.67 0.01-23.36 13.5-37.32 37.67-37.32 64.66v241.8c0 27 13.96 51.17 37.34 64.67 11.68 6.75 24.5 10.11 37.32 10.11s25.65-3.38 37.33-10.12l209.39-120.89c23.39-13.5 37.34-37.67 37.34-64.66 0.01-26.98-13.94-51.16-37.32-64.67zM448 619.3V414.46l177.4 102.42L448 619.3z"
                        fill="#d81e06"
                        p-id="3452"
                    />
                    <path
                        d="M512 42.67C253.21 42.67 42.67 253.21 42.67 512S253.21 981.33 512 981.33 981.33 770.79 981.33 512 770.79 42.67 512 42.67zM512 896c-211.74 0-384-172.26-384-384s172.26-384 384-384 384 172.26 384 384-172.26 384-384 384z"
                        fill="#d81e06"
                        p-id="3453"
                    />
                </svg>
            </div>
            <div className="w-full text-center">{s ?? ''}</div>
        </div>
    );
}
