import { like, or, eq } from 'drizzle-orm';
import { injectable } from 'inversify';

import db from '@/backend/infrastructure/db';
import { InsertWord, Word, words } from '@/backend/infrastructure/db/tables/words';
import WordsRepository, { GetAllWordsQuery } from '@/backend/application/ports/repositories/WordsRepository';

/**
 * 单词仓储实现。
 */
@injectable()
export default class WordsRepositoryImpl implements WordsRepository {

    public async getAll(query: GetAllWordsQuery = {}): Promise<Word[]> {
        return db
            .select()
            .from(words)
            .where(
                query.search
                    ? or(
                        like(words.word, `%${query.search}%`),
                        like(words.translate, `%${query.search}%`),
                    )
                    : undefined,
            );
    }

    /**
     * 使用导入结果整体替换当前单词表。
     *
     * 行为说明：
     * - 该操作会先清空现有单词，再写入传入的完整结果集。
     * - 空数组表示清空单词表，而不是跳过。
     *
     * @param values 导入后的完整单词列表。
     */
    public async replaceAll(values: InsertWord[]): Promise<void> {
        db.transaction((tx) => {
            tx.delete(words).run();
            if (values.length === 0) {
                return;
            }

            tx.insert(words).values(values).run();
        });
    }

    public async addWord(word: string, translate?: string): Promise<void> {
        await db
            .insert(words)
            .values({
                word: word.trim().toLowerCase(),
                translate: translate?.trim() || null,
            })
            .onConflictDoNothing();
    }

    public async updateWord(word: string, translate: string): Promise<void> {
        await db
            .update(words)
            .set({
                translate: translate.trim(),
                updated_at: new Date().toISOString(),
            })
            .where(eq(words.word, word.trim().toLowerCase()));
    }

    public async deleteWord(word: string): Promise<void> {
        await db.delete(words).where(eq(words.word, word.trim().toLowerCase()));
    }
}
