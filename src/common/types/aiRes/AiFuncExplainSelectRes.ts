export interface AiFuncExplainSelectRes {
    sentence: {
        sentence: string;
        meaning: string;
    };
    word: {
        word: string;
        phonetic: string;
        meaning: string;
        meaningInSentence: string;
    };
    idiom?: {
        idiom: string;
        meaning: string;
    };
}
