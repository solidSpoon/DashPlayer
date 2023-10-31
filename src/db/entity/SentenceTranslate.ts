export interface SentenceTranslate {
    id?: number;
    sentence?: string;
    translate?: string;
    created_at?: string;
    updated_at?: string;
}

export const SENTENCE_TRANSLATE_TABLE_NAME = 'dp_sentence_translate';
