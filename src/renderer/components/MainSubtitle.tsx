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
    showEn: boolean;
    showCn: boolean;
}

const secondEle = (text: string, key: string, show: boolean): ReactElement => {
    return (
        <div key={key} className="my-0 mx-10 text-3xl py-2.5 px-10">
            <span
                className={`${
                    show ? '' : 'text-transparent bg-white/5 rounded'
                }`}
            >
                {text}
            </span>
        </div>
    );
};

const thirdEle = (text: string, key: string, show: boolean): ReactElement => {
    return (
        <div
            key={key}
            className="drop-shadow my-0 mx-10 text-2xl py-2.5 px-10 rounded-lg"
        >
            <span
                className={`${
                    show ? '' : 'text-transparent bg-white/5 rounded'
                }`}
            >
                {text}
            </span>
        </div>
    );
};
export default function MainSubtitle({
    sentence,
    doAction,
    showEn,
    showCn,
}: MainSubtitleParam) {
    const firstEle = (
        text: string,
        key: string,
        showE: boolean
    ): ReactElement => {
        return (
            <TranslatableLine
                key={key}
                text={text || ''}
                doAction={doAction}
                show={showE}
            />
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
        const mapMethod: ((
            text: string,
            key: string,
            showE: boolean
        ) => React.ReactElement)[] = [firstEle, secondEle, thirdEle];
        mapMethod.forEach((method, index) => {
            if (tempEle[index] !== undefined) {
                elements.push(
                    method(
                        tempEle[index],
                        `main-sentence-${index}-${sentence.getKey()}`,
                        index === 0 ? showEn : showCn
                    )
                );
            }
        });
        return elements;
    };

    const render = () => {
        if (sentence === undefined) {
            return (
                <div className="w-full h-full shadow-inner shadow-neutral-900" />
            );
        }
        return (
            <div
                key={`trans-sub:${sentence?.getKey()}`}
                className="flex flex-col w-full h-full text-center"
            >
                {ele()}
            </div>
        );
    };

    return render();
}
