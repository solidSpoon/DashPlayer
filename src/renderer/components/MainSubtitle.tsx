import React, { ReactElement } from 'react';
import SentenceT from '../lib/param/SentenceT';
import TranslatableLine from './TranslatableLine';
import { Action } from '../lib/CallAction';
import NormalLine from './NormalLine';

interface MainSubtitleParam {
    sentence: undefined | SentenceT;
    doAction: (action: Action) => void;
    showEn: boolean;
    showCn: boolean;
}
export default function MainSubtitle({
    sentence,
    doAction,
    showEn,
    showCn,
}: MainSubtitleParam) {
    const ele = (): ReactElement[] => {
        if (sentence === undefined) {
            return [];
        }
        const tempEle: Array<string> = [
            sentence.text,
            sentence.msTranslate,
            sentence.textZH,
        ]
            .filter((item) => item !== undefined)
            .map((item) => item ?? '');
        return tempEle.map((item, index) => {
            if (index === 0) {
                return (
                    <TranslatableLine
                        key={`first-${sentence.getKey()}`}
                        text={item}
                        doAction={doAction}
                        show={showEn}
                    />
                );
            }
            if (index === 1) {
                return (
                    <NormalLine
                        key={`second-${sentence.getKey()}`}
                        text={item}
                        order="second"
                        show={showCn}
                    />
                );
            }

            return (
                <NormalLine
                    key={`third-${sentence.getKey()}`}
                    text={item}
                    order="third"
                    show={showCn}
                />
            );
        });
    };

    const render = () => {
        if (sentence === undefined) {
            return <div className="w-full h-full" />;
        }
        return (
            <div
                key={`trans-sub:${sentence?.getKey()}`}
                className="flex flex-col w-full h-full text-center text-textColor shadow-inner"
            >
                {ele()}
            </div>
        );
    };

    return render();
}
