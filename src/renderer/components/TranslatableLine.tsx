import axios from "axios";
import {ReactElement} from "react";
import s from './css/TranslatableLine.module.css';

interface TranslatableSubtitleLineParam {
    text: string,
    className?: string
}

const TranslatableLine = (props: TranslatableSubtitleLineParam) => {
    if (props.text === undefined) {
        return <></>;
    }
    let keyIndex = 0;
    const trans = (str: string): void => {
        axios.get('/api/appleTrans', {params: {str: str}});
    }
    const notWord = (str: string): ReactElement => {
        return <span className={s.notWord} key={keyIndex++}>{str}</span>;
    }
    const word = (str: string): ReactElement => {
        const t = () => trans(str);
        return <>
            <span
                className={s.word}
                key={keyIndex++}
                onClick={t}
            >
                {str}
            </span>
        </>
    }
    const isWord = (str: string): boolean => {
        const noWordRegex = /[^A-Za-z0-9\-]/;
        return !noWordRegex.test(str);
    }
    const words: string[] = props.text.split(/((?<=.)(?=[^A-Za-z0-9\-]))|((?<=[^A-Za-z0-9\-])(?=.))/);

    function ele(): ReactElement[] {
        return words.map(w => {
            if (isWord(w)) {
                return word(w);
            } else {
                return notWord(w);
            }
        });
    }

  return (
    // @ts-ignore
        <div key={1} className={props.className ? props.className : null}>
            {ele()}
        </div>
    )
}

export default TranslatableLine;
