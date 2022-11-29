import { ReactElement } from 'react';
import s from './css/TranslatableLine.module.css';

interface TranslatableSubtitleLineParam {
    text: string;
    className: string | undefined;
}

const TranslatableLine = (props: TranslatableSubtitleLineParam) => {
    const { text } = props;
    if (text === undefined) {
        return <></>;
    }
    let keyIndex = 0;
    const trans = (str: string): void => {
        console.log('click');
        window.electron.ipcRenderer.sendMessage('trans-word', [str]);
        window.electron.ipcRenderer.once('trans-word', () => {
            console.log('trans word success');
        });
    };
    const notWord = (str: string): ReactElement => {
        keyIndex += 1;
        return (
            <span className={s.notWord} key={keyIndex}>
                {str}
            </span>
        );
    };
    const word = (str: string): ReactElement => {
        const t = () => trans(str);
        keyIndex += 1;
        return (
            <>
                {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events,jsx-a11y/no-static-element-interactions */}
                <span className={s.word} key={keyIndex} onClick={t}>
                    {str}
                </span>
            </>
        );
    };
    const isWord = (str: string): boolean => {
        const noWordRegex = /[^A-Za-z0-9-]/;
        return !noWordRegex.test(str);
    };
    // eslint-disable-next-line react/destructuring-assignment
    const words: string[] = props.text.split(
        /((?<=.)(?=[^A-Za-z0-9-]))|((?<=[^A-Za-z0-9-])(?=.))/
    );

    function ele(): ReactElement[] {
        return words.map((w) => {
            if (isWord(w)) {
                return word(w);
            }
            return notWord(w);
        });
    }

    return (
        // eslint-disable-next-line react/destructuring-assignment
        <div key={1} className={props.className}>
            {ele()}
        </div>
    );
};

export default TranslatableLine;
