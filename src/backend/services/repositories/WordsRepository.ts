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
}
