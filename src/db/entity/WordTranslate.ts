export interface WordTranslate {
    id?: number;
    word?: string;
    translate?: string;
    created_at?: string;
    updated_at?: string;
}

export const WORD_TRANSLATE_TABLE_NAME = 'dp_word_translate';
