import React, { Component, PureComponent, ReactElement, useState } from 'react';
import {
    autoPlacement,
    offset,
    useFloating,
    useHover,
    useInteractions,
} from '@floating-ui/react';
import SentenceT from '../lib/param/SentenceT';
import TranslatableLine from './TranslatableLine';
import { Action } from '../lib/CallAction';

interface MainSubtitleParam {
    sentence: undefined | SentenceT;
    doAction: (action: Action) => void;
}

const secondEle = (text: string, key: string): ReactElement => {
    return (
        <div key={key} className="my-0 mx-10 text-3xl py-2.5 px-10">
            {text}
        </div>
    );
};

const thirdEle = (text: string, key: string): ReactElement => {
    return (
        <div
            key={key}
            className="drop-shadow my-0 mx-10 text-2xl py-2.5 px-10 bg-neutral-700 rounded-lg"
        >
            {text}
        </div>
    );
};
export default function MainSubtitle({
    sentence,
    doAction,
}: MainSubtitleParam) {
    const firstEle = (text: string, key: string): ReactElement => {
        return (
            <TranslatableLine key={key} text={text || ''} doAction={doAction} />
        );
    };
    const ele = (): ReactElement[] => {
        const elements: ReactElement[] = [];
        if (sentence === undefined) {
            return elements;
        }
        const tempEle: string[] = [
            sentence.text,
            sentence.msTranslate,
            sentence.textZH,
        ]
            .filter((item) => item !== undefined)
            .map((item) => item || '');
        const mapMethod: ((text: string, key: string) => React.ReactElement)[] =
            [firstEle, secondEle, thirdEle];
        mapMethod.forEach((method, index) => {
            if (tempEle[index] !== undefined) {
                elements.push(
                    method(
                        tempEle[index],
                        `main-sentence-${index}-${sentence.getKey()}`
                    )
                );
            }
        });
        return elements;
    };

    const render = () => {
        if (sentence === undefined) {
            return <></>;
        }
        return (
            <div
                key={`trans-sub:${sentence?.getKey()}`}
                className="flex flex-col text-center"
            >
                {ele()}
            </div>
        );
    };

    return render();
}
