export interface AiPhraseGroupRes {
    sentence: string;
    phraseGroups: {
        original: string;
        translation: string;
        comment: string;
    }[];
}
