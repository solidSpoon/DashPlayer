import { Word } from '@/backend/db/tables/words';
import db from '@/backend/db/db';

export interface SimpleVocabularyService {
    getVocabularyWords(): Promise<Word[]>;
    getWordsByIds(ids: number[]): Promise<Word[]>;
}

export default class SimpleVocabularyServiceImpl implements SimpleVocabularyService {
    
    async getVocabularyWords(): Promise<Word[]> {
        const { words } = await import('@/backend/db/tables/words');
        return await db.select().from(words);
    }
    
    async getWordsByIds(ids: number[]): Promise<Word[]> {
        const { words } = await import('@/backend/db/tables/words');
        const { inArray } = await import('drizzle-orm');
        
        if (ids.length === 0) return [];
        
        return await db
            .select()
            .from(words)
            .where(inArray(words.id, ids));
    }
}