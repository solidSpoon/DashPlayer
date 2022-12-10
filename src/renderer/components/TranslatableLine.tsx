import { ReactElement } from 'react';
import hash from '../lib/hash';

interface TranslatableSubtitleLineParam {
    text: string;
}

const TranslatableLine = ({ text }: TranslatableSubtitleLineParam) => {
    if (text === undefined) {
        return <></>;
    }
    const trans = (str: string): void => {
        console.log('click');
        window.electron.ipcRenderer.sendMessage('trans-word', [str]);
        window.electron.ipcRenderer.once('trans-word', () => {
            console.log('trans word success');
        });
    };
    const notWord = (str: string, key: string): ReactElement => {
        return (
            <span className="select-none" key={key}>
                {str}
            </span>
        );
    };
    const word = (str: string, key: string): ReactElement => {
        const t = () => trans(str);
        return (
            <>
                {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events,jsx-a11y/no-static-element-interactions */}
                <span
                    className="rounded select-none hover:bg-zinc-600"
                    key={key}
                    onClick={t}
                >
                    {str}
                </span>
            </>
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
            console.log(key);
            if (isWord(w)) {
                return word(w, `nw:${key}`);
            }
            return notWord(w, `w:${key}`);
        });
    }

    return (
        <div className="bg-neutral-700 rounded-lg drop-shadow-md hover:drop-shadow-xl text-3xl mx-10 mt-2.5 px-10 py-2.5 shadow-inner shadow-neutral-600">
            {ele()}
        </div>
    );
};

export default TranslatableLine;
