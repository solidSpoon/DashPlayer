export interface WordLevel {
    id?: number;
    word?: string;
    /**
     * 1: 掌握
     * 2: 正常
     */
    level?: number;
    translate?: string;
    created_at?: string;
    updated_at?: string;
}
export const WORD_LEVEL_TABLE_NAME = 'dp_word_level';
