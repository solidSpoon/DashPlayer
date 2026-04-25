import { InsertWord, Word } from '@/backend/infrastructure/db/tables/words';

/**
 * 单词列表查询参数。
 */
export interface GetAllWordsQuery {
    search?: string;
}

/**
 * 单词仓储接口。
 */
export default interface WordsRepository {
    getAll(query?: GetAllWordsQuery): Promise<Word[]>;
    replaceAll(values: InsertWord[]): Promise<void>;
    /**
     * 添加单词到生词本。
     * word 字段在 DB 层有 UNIQUE 约束，重复插入使用 onConflictDoNothing 静默忽略。
     *
     * @param word 单词原文（调用方负责归一化处理）。
     * @param translate 可选释义。
     */
    addWord(word: string, translate?: string): Promise<void>;

    /**
     * 更新单词释义。
     * @param word 单词原文。
     * @param translate 释义内容。
     */
    updateWord(word: string, translate: string): Promise<void>;

    /**
     * 从生词本中删除单词。
     * @param word 单词原文。
     */
    deleteWord(word: string): Promise<void>;
}
