import React, { Component, ReactElement } from 'react';
import SentenceT from '../lib/param/SentenceT';
import TranslatableLine from './TranslatableLine';

interface MainSubtitleState {
    sentence: undefined | SentenceT;
}

export default class MainSubtitle extends Component<any, MainSubtitleState> {
    constructor(props: never) {
        super(props);
        this.state = {
            sentence: undefined,
        };
    }

    private ele(): ReactElement[] {
        const { sentence } = this.state;
        const elements: ReactElement[] = [];
        if (sentence === undefined) {
            return elements;
        }
        elements.push(
            <TranslatableLine
                key={1}
                text={sentence.text ? sentence.text : ''}
            />
        );
        if (sentence.msTranslate !== undefined) {
            elements.push(
                <div key={2} className="my-0 mx-10 text-3xl py-2.5 px-10">
                    {sentence.msTranslate}
                </div>
            );
        }
        if (sentence.textZH !== undefined) {
            elements.push(
                <div
                    key={3}
                    className="my-0 mx-10 text-2xl py-2.5 px-10 bg-neutral-700"
                >
                    {sentence.textZH}
                </div>
            );
        }
        return elements;
    }

    render() {
        return <div className="flex flex-col text-center">{this.ele()}</div>;
    }
}
