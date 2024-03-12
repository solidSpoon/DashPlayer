import { ReactElement } from 'react';
import { cn } from '@/common/utils/Util';
import usePlayerController from "@/fronted/hooks/usePlayerController";
import useSetting from "@/fronted/hooks/useSetting";
import hash from "@/common/utils/hash";
import {FONT_SIZE} from "@/fronted/styles/style";


interface PlayerNormalLineParam {
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
const PlayerNormalLine = ({ text, order }: PlayerNormalLineParam) => {
    const show = usePlayerController((state) => state.showCn);
    const fontSize = useSetting((state) => state.values.get('appearance.fontSize'));
    if (text === undefined || !show) {
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
        return <span key={key}>{str}</span>;
    };

    const notWord = (str: string, key: string): ReactElement => {
        return <span key={key}>{str === ' ' ? <>&nbsp;</> : str}</span>;
    };
    return (
        <div
            className={cn(`my-0 mx-10 py-2.5 px-1 bg-black/50 text-white rounded`,
                fontSize === 'fontSizeSmall' &&(order === 'second' ? FONT_SIZE["ms2-small"] : FONT_SIZE["ms3-small"]),
                fontSize === 'fontSizeMedium' &&(order === 'second' ? FONT_SIZE["ms2-medium"] : FONT_SIZE["ms3-medium"]),
                fontSize === 'fontSizeLarge' &&(order === 'second' ? FONT_SIZE["ms2-large"] : FONT_SIZE["ms3-large"]),
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

export default PlayerNormalLine;
