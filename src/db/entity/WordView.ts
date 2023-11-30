export interface WordView {
    word?: string;
    translate?: string;
    familiar?: number;
    updated_at?: string;
    note?: string;
    stem?: string;
}
export const WORD_VIEW_TABLE_NAME = 'dp_word_view';
