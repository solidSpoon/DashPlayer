import { ReactElement, useState } from 'react';
import hash from '../lib/hash';
import Word from './Word';
import { Action } from '../lib/CallAction';
import { d } from '@pmmmwh/react-refresh-webpack-plugin/types/options';

interface TranslatableSubtitleLineParam {
    text: string;
    doAction: (action: Action) => void;
}

const TranslatableLine = ({
    text,
    doAction,
}: TranslatableSubtitleLineParam) => {
    if (text === undefined) {
        return <></>;
    }
    const notWord = (str: string, key: string): ReactElement => {
        return (
            <div className="select-none" key={key}>
                {str === ' ' ? <>&nbsp;</> : str}
            </div>
        );
    };

    const isWord = (str: string): boolean => {
        const noWordRegex = /[^A-Za-z0-9-]/;
        return !noWordRegex.test(str);
    };

    const words: string[] = text.split(
        /((?<=.)(?=[^A-Za-z0-9-]))|((?<=[^A-Za-z0-9-])(?=.))/
    );

    function ele(): ReactElement[] {
        return words.map((w, index) => {
            const key = `${hash(text)}:${index}`;
            if (isWord(w)) {
                return <Word key={`nw:${key}`} word={w} doAction={doAction} />;
            }
            return notWord(w, `w:${key}`);
        });
    }

    return (
        <div className="flex justify-center items-center gap-0 bg-neutral-700 rounded-lg drop-shadow-md hover:drop-shadow-xl text-3xl mx-10 mt-2.5 px-10 py-2.5 shadow-inner shadow-neutral-600">
            {ele()}
        </div>
    );
};

export default TranslatableLine;
