import { InsertWord, Word } from '@/backend/infrastructure/db/tables/words';

export interface GetAllWordsQuery {
    search?: string;
}

export type WordsUpdatePatch = Partial<Pick<InsertWord, 'stem' | 'translate' | 'note' | 'updated_at'>>;

export default interface WordsRepository {
    getAll(query?: GetAllWordsQuery): Promise<Word[]>;
    findIdByWord(word: string): Promise<number | null>;
    insert(values: InsertWord): Promise<void>;
    updateByWord(word: string, patch: WordsUpdatePatch): Promise<void>;
    upsert(values: InsertWord): Promise<Word>;
}

