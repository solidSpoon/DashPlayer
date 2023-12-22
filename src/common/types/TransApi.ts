import SentenceT from './SentenceT';

export interface SentenceApiParam {
    index: number;
    text: string;
    translate: string | undefined;
}

export const toSentenceApiParam = (sentence: SentenceT): SentenceApiParam => {
    return {
        index: sentence.index,
        text: sentence.text ?? '',
        translate: undefined,
    };
};
