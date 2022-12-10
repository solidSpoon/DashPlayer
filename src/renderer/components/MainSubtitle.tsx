import React, { Component, PureComponent, ReactElement } from 'react';
import SentenceT from '../lib/param/SentenceT';
import TranslatableLine from './TranslatableLine';

interface MainSubtitleParam {
    sentence: undefined | SentenceT;
}

export default class MainSubtitle extends Component<MainSubtitleParam, never> {
    private firstEle = (text: string, key: string): ReactElement => {
        return <TranslatableLine key={key} text={text || ''} />;
    };

    private secondEle = (text: string, key: string): ReactElement => {
        return (
            <div key={key} className="my-0 mx-10 text-3xl py-2.5 px-10">
                {text}
            </div>
        );
    };

    private thirdEle = (text: string, key: string): ReactElement => {
        return (
            <div
                key={key}
                className="drop-shadow my-0 mx-10 text-2xl py-2.5 px-10 bg-neutral-700 rounded-lg"
            >
                {text}
            </div>
        );
    };

    private ele(): ReactElement[] {
        const { sentence } = this.props;
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
            [this.firstEle, this.secondEle, this.thirdEle];
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
