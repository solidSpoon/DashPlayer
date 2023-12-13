import { ReactElement } from 'react';
import hash from '../lib/hash';
import usePlayerController from '../hooks/usePlayerController';
import { cn } from '../../utils/Util';
import useSetting from '../hooks/useSetting';
import { FontSize } from '../styles/style';

interface NormalLineParam {
    text: string;
    order: 'second' | 'third';
}
interface Part {
    content: string;
    isWord: boolean;
    id: string;
}
export const SPLIT_REGEX =
    /((?<=.)(?=[^A-Za-z0-9\u4e00-\u9fa5-]))|((?<=[^A-Za-z0-9\u4e00-\u9fa5-])(?=.))/;
const NormalLine = ({ text, order }: NormalLineParam) => {
    const show = usePlayerController((state) => state.showCn);
    const fontSize = useSetting((state) => state.values.get('appearance.fontSize'));
    if (text === undefined) {
        return <div />;
    }
    const isWord = (str: string): boolean => {
        const noWordRegex = /[^A-Za-z0-9-\u4e00-\u9fa5]/;
        return !noWordRegex.test(str);
    };
    const textHash = hash(text);
    const words: Part[] = text
        .replace(/\s+/g, ' ')
        .split(SPLIT_REGEX)
        .filter((w) => w)
        .map((w, index) => {
            return {
                content: w,
                isWord: isWord(w),
                id: `${textHash}:${index}`,
            };
        });

    const word = (str: string, key: string): ReactElement => {
        return (
            <span
                className={`${
                    show
                        ? ''
                        : 'text-transparent bg-wordHoverBackground/50 rounded'
                }`}
                key={key}
            >
                {str}
            </span>
        );
    };

    const notWord = (str: string, key: string): ReactElement => {
        return (
            <span className={`${show ? '' : 'text-transparent'} `} key={key}>
                {str === ' ' ? <>&nbsp;</> : str}
            </span>
        );
    };
    return (
        <div
            className={cn(`my-0 mx-10 py-2.5 px-1 text-mainSubtitleTwoColor`,
                fontSize === 'fontSizeSmall' &&(order === 'second' ? FontSize.mainSubtitleTwo.small : FontSize.mainSubtitleThree.small),
                fontSize === 'fontSizeMedium' &&(order === 'second' ? FontSize.mainSubtitleTwo.medium : FontSize.mainSubtitleThree.medium),
                fontSize === 'fontSizeLarge' &&(order === 'second' ? FontSize.mainSubtitleTwo.large : FontSize.mainSubtitleThree.large),
                )}
        >
            {words.map((w) => {
                if (w.isWord) {
                    return word(w.content, w.id);
                }
                return notWord(w.content, w.id);
            })}
        </div>
    );
};

export default NormalLine;
