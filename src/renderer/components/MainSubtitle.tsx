import React, { PureComponent, ReactElement } from 'react';
import SentenceT from '../lib/param/SentenceT';
import TranslatableLine from './TranslatableLine';

interface MainSubtitleParam {
    sentence: undefined | SentenceT;
}

export default class MainSubtitle extends PureComponent<
    MainSubtitleParam,
    never
> {
    private ele(): ReactElement[] {
        const { sentence } = this.props;
        const elements: ReactElement[] = [];
        if (sentence === undefined) {
            return elements;
        }
        elements.push(
            <TranslatableLine
                key={`first-line:${sentence.getKey()}`}
                text={sentence.text ? sentence.text : ''}
            />
        );
        if (sentence.msTranslate !== undefined) {
            elements.push(
                <div
                    key={`secondLine${sentence.getKey()}`}
                    className="my-0 mx-10 text-3xl py-2.5 px-10"
                >
                    {sentence.msTranslate}
                </div>
            );
        }
        if (sentence.textZH !== undefined) {
            elements.push(
                <div
                    key={`third-line${sentence.getKey()}`}
                    className="drop-shadow my-0 mx-10 text-2xl py-2.5 px-10 bg-neutral-700 rounded-lg"
                >
                    {sentence.textZH}
                </div>
            );
        }
        return elements;
    }

    render() {
        const { sentence } = this.props;
        if (sentence === undefined) {
            return <></>;
        }
        return (
            <div
                key={`trans-sub:${sentence?.getKey()}`}
                className="flex flex-col text-center"
            >
                {this.ele()}
            </div>
        );
    }
}
