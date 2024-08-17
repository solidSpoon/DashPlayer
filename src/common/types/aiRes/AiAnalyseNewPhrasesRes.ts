export interface AiAnalyseNewPhrasesRes {
    hasPhrase: boolean;
    phrases: {
        phrase: string;
        meaning: string;
    }[];
}
