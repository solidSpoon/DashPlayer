import React, { ReactElement } from 'react';
import TranslatableLine from './TranslatableLine';
import NormalLine from './NormalLine';
import usePlayerController from '../hooks/usePlayerController';

export default function MainSubtitle() {
    const sentence = usePlayerController((state) => state.currentSentence);
    const clearAdjust = usePlayerController((state) => state.clearAdjust);
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
                        adjusted={sentence.originalBegin != undefined || sentence.originalEnd != undefined}
                        clearAdjust={clearAdjust}
                        key={`first-${sentence.getKey()}`}
                        text={item}
                    />
                );
            }
            if (index === 1) {
                return (
                    <NormalLine
                        key={`second-${sentence.getKey()}`}
                        text={item}
                        order="second"
                    />
                );
            }

            return (
                <NormalLine
                    key={`third-${sentence.getKey()}`}
                    text={item}
                    order="third"
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
