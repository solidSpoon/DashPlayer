import { and, eq } from 'drizzle-orm';
import { injectable } from 'inversify';

import db from '@/backend/infrastructure/db';
import { wordTranslates } from '@/backend/infrastructure/db/tables/wordTranslates';
import TimeUtil from '@/common/utils/TimeUtil';

import WordTranslatesRepository from '@/backend/services/repositories/WordTranslatesRepository';

@injectable()
export default class WordTranslatesRepositoryImpl implements WordTranslatesRepository {

    public async findOne(word: string, provider: string) {
        const rows = await db
            .select()
            .from(wordTranslates)
            .where(and(eq(wordTranslates.word, word), eq(wordTranslates.provider, provider)))
            .limit(1);
        return rows[0] ?? null;
    }

    public async upsert(word: string, provider: string, translate: string, updatedAt?: string): Promise<void> {
        await db
            .insert(wordTranslates)
            .values({
                word,
                provider,
                translate,
            })
            .onConflictDoUpdate({
                target: [wordTranslates.word, wordTranslates.provider],
                set: { translate, updated_at: updatedAt ?? TimeUtil.timeUtc() },
            });
    }

    public async deleteByProvider(provider: string): Promise<number> {
        const result = await db
            .delete(wordTranslates)
            .where(eq(wordTranslates.provider, provider));
        return result.changes ?? 0;
    }
}

