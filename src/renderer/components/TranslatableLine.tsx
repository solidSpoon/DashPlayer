import { ReactElement, useCallback, useState } from 'react';
import hash from '../lib/hash';
import Word from './Word';
import { Action } from '../lib/CallAction';

interface TranslatableSubtitleLineParam {
    text: string;
    doAction: (action: Action) => void;
}
interface Part {
    content: string;
    isWord: boolean;
    id: string;
}
const TranslatableLine = ({
    text,
    doAction,
}: TranslatableSubtitleLineParam) => {
    console.log('TranslatableLine');
    const [popELe, setPopEle] = useState<string | null>(null);
    if (text === undefined) {
        return <div />;
    }

    const isWord = (str: string): boolean => {
        const noWordRegex = /[^A-Za-z0-9-]/;
        return !noWordRegex.test(str);
    };
    const textHash = hash(text);
    const words: Part[] = text
        .split(/((?<=.)(?=[^A-Za-z0-9-]))|((?<=[^A-Za-z0-9-])(?=.))/)
        .filter((w) => w)
        .map((w, index) => {
            return {
                content: w,
                isWord: isWord(w),
                id: `${textHash}:${index}`,
            };
        });
    const notWord = (str: string, key: string): ReactElement => {
        return (
            <div className="select-none" key={key}>
                {str === ' ' ? <>&nbsp;</> : str}
            </div>
        );
    };
    const handleRequestPop = (k: string) => {
        if (popELe !== k) {
            setPopEle(k);
        }
    };
    function ele(): ReactElement[] {
        return words.map((w) => {
            if (w.isWord) {
                return (
                    <Word
                        key={w.id}
                        word={w.content}
                        doAction={doAction}
                        pop={popELe === w.id}
                        requestPop={(b) => handleRequestPop(w.id)}
                    />
                );
            }
            return notWord(w.content, w.id);
        });
    }

    console.log('avvv popEle', popELe);
    return (
        <div className="flex flex-wrap justify-center items-center gap-0 bg-neutral-700 rounded-lg drop-shadow-md hover:drop-shadow-xl text-3xl mx-10 mt-2.5 px-10 py-2.5 shadow-inner shadow-neutral-600">
            {ele()}
        </div>
    );
};

export default TranslatableLine;
