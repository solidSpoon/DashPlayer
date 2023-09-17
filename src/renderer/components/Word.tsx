import { useEffect, useState } from 'react';
import callApi from '../lib/apis/ApiWrapper';
import { YdRes } from '../lib/param/yd/a';
import WordSub from './WordSub';
import { Action, pause, space } from '../lib/CallAction';

export interface WordParam {
    word: string;
    doAction: (action: Action) => void;
}
const Word = ({ word, doAction }: WordParam) => {
    const [translationText, setTranslationText] = useState<string | undefined>(
        undefined
    );
    const [hovered, setHovered] = useState(false);
    const trans = (str: string): void => {
        console.log('click');
        window.electron.ipcRenderer.sendMessage('trans-word', [str]);
        window.electron.ipcRenderer.once('trans-word', () => {
            console.log('trans word success');
        });
    };
    const t = () => trans(word);

    useEffect(() => {
        const transFun = async (str: string) => {
            const r = (await callApi('you-dao-translate', [str])) as string;
            if (r === null) {
                return;
            }
            const res = JSON.parse(r) as YdRes;
            setTranslationText(res.translation?.join('\n') ?? '');
        };
        if (hovered) {
            transFun(word);
        }
    }, [hovered, word]);

    return (
        <>
            <div
                className="rounded  select-none hover:bg-zinc-600"
                onMouseOver={() => {
                    setHovered(true);
                    doAction(pause());
                }}
                onMouseLeave={() => setHovered(false)}
                onClick={t}
            >
                {translationText && hovered ? (
                    <WordSub word={word} translation={translationText} />
                ) : (
                    <div>{word}</div>
                )}
            </div>
        </>
    );
};

export default Word;
