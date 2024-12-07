import React, { ReactElement } from 'react';
import TranslatableLine from './TranslatableLine';
import NormalLine from './NormalLine';
import usePlayerController from '../hooks/usePlayerController';

export default function MainSubtitle() {
    const sentence = usePlayerController((state) => state.currentSentence);
    const clearAdjust = usePlayerController((state) => state.clearAdjust);
    const srtTender = usePlayerController((state) => state.srtTender);
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
                        adjusted={srtTender?.adjusted(sentence) ?? false}
                        clearAdjust={clearAdjust}
                        key={`first-${sentence.key}`}
                        sentence={sentence}
                    />
                );
            }
            if (index === 1) {
                return (
                    <NormalLine
                        key={`second-${sentence.key}`}
                        text={item}
                        order="second"
                    />
                );
            }

            return (
                <NormalLine
                    key={`third-${sentence.key}`}
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
                key={`trans-sub:${sentence?.key}`}
                className="flex flex-col w-full text-center text-textColor shadow-inner h-0"
            >
                {ele()}
            </div>
        );
    };

    return render();
}
