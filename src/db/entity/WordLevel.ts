export interface WordLevel {
    id?: number;
    word?: string;
    stem?: string;
    note?: string;
    translate?: string;
    created_at?: string;
    updated_at?: string;
}
export const WORD_LEVEL_TABLE_NAME = 'dp_word_level';
