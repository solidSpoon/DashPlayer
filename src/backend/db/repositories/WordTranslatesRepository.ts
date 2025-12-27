import { WordTranslate } from '@/backend/db/tables/wordTranslates';

export default interface WordTranslatesRepository {
    findOne(word: string, provider: string): Promise<WordTranslate | null>;
    upsert(word: string, provider: string, translate: string, updatedAt?: string): Promise<void>;
}

