import { and, eq, inArray } from 'drizzle-orm';
import { injectable } from 'inversify';

import db from '@/backend/infrastructure/db';
import { sentenceTranslates } from '@/backend/infrastructure/db/tables/sentenceTranslates';
import TimeUtil from '@/common/utils/TimeUtil';

import SentenceTranslatesRepository, {
    SentenceTranslatesUpsertParams,
} from '@/backend/services/repositories/SentenceTranslatesRepository';

@injectable()
export default class SentenceTranslatesRepositoryImpl implements SentenceTranslatesRepository {

    public async findBySentencesAndMode(sentences: string[], mode: string) {
        if (sentences.length === 0) {
            return [];
        }
        return db
            .select()
            .from(sentenceTranslates)
            .where(and(inArray(sentenceTranslates.sentence, sentences), eq(sentenceTranslates.mode, mode)));
    }

    public async upsert(params: SentenceTranslatesUpsertParams): Promise<void> {
        await db
            .insert(sentenceTranslates)
            .values({
                sentence: params.sentence,
                translate: params.translate,
                mode: params.mode,
            })
            .onConflictDoUpdate({
                target: [sentenceTranslates.sentence, sentenceTranslates.mode],
                set: {
                    translate: params.translate,
                    mode: params.mode,
                    updated_at: params.updated_at ?? TimeUtil.timeUtc(),
                },
            });
    }

    public async upsertMany(params: SentenceTranslatesUpsertParams[]): Promise<void> {
        await Promise.all(params.map((item) => this.upsert(item)));
    }

    public async deleteByMode(mode: string): Promise<number> {
        const result = await db
            .delete(sentenceTranslates)
            .where(eq(sentenceTranslates.mode, mode));
        return result.changes ?? 0;
    }
}

