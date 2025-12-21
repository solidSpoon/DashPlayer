import { eq, like, or } from 'drizzle-orm';
import { injectable } from 'inversify';

import db from '@/backend/db';
import { InsertWord, Word, words } from '@/backend/db/tables/words';
import { getMainLogger } from '@/backend/ioc/simple-logger';
import WordsRepository, { GetAllWordsQuery, WordsUpdatePatch } from '@/backend/db/repositories/WordsRepository';

@injectable()
export default class WordsRepositoryImpl implements WordsRepository {

    private readonly logger = getMainLogger('WordsRepository');

    public async getAll(query: GetAllWordsQuery = {}): Promise<Word[]> {
        return db
            .select()
            .from(words)
            .where(
                query.search
                    ? or(
                        like(words.word, `%${query.search}%`),
                        like(words.translate, `%${query.search}%`),
                        like(words.stem, `%${query.search}%`),
                    )
                    : undefined,
            );
    }

    public async findIdByWord(word: string): Promise<number | null> {
        const result = db
            .select({ id: words.id })
            .from(words)
            .where(eq(words.word, word))
            .get();
        return result?.id ?? null;
    }

    public async insert(values: InsertWord): Promise<void> {
        await db.insert(words).values(values);
    }

    public async updateByWord(word: string, patch: WordsUpdatePatch): Promise<void> {
        const updated_at = patch.updated_at ?? new Date().toISOString();
        await db
            .update(words)
            .set({
                ...patch,
                updated_at,
            })
            .where(eq(words.word, word));
    }

    public async upsert(values: InsertWord): Promise<Word> {
        const updated_at = values.updated_at ?? new Date().toISOString();
        const results = await db
            .insert(words)
            .values({
                ...values,
                updated_at,
            })
            .onConflictDoUpdate({
                target: [words.word],
                set: {
                    stem: values.stem,
                    translate: values.translate,
                    note: values.note,
                    updated_at,
                },
            })
            .returning();

        const record = results[0];
        if (!record) {
            this.logger.warn('upsert returned empty result', { word: values.word });
            throw new Error('upsert failed: empty result');
        }

        return record;
    }
}
