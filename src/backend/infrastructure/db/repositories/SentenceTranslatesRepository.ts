import { InsertSentenceTranslate, SentenceTranslate } from '@/backend/infrastructure/db/tables/sentenceTranslates';

export type SentenceTranslatesUpsertParams = Pick<InsertSentenceTranslate, 'sentence' | 'translate' | 'mode'> & Partial<Pick<InsertSentenceTranslate, 'updated_at'>>;

export default interface SentenceTranslatesRepository {
    findBySentencesAndMode(sentences: string[], mode: string): Promise<SentenceTranslate[]>;
    findTranslatedBySentencesAndMode(sentences: string[], mode: string): Promise<SentenceTranslate[]>;
    upsert(params: SentenceTranslatesUpsertParams): Promise<void>;
    upsertMany(params: SentenceTranslatesUpsertParams[]): Promise<void>;
}

