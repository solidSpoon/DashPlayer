import SentenceC from './SentenceC';

export interface SentenceApiParam {
    index: number;
    text: string;
    translate: string | undefined;
}

export const toSentenceApiParam = (sentence: SentenceC): SentenceApiParam => {
    return {
        index: sentence.index,
        text: sentence.text ?? '',
        translate: undefined,
    };
};
