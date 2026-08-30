import { like, or } from 'drizzle-orm';
import { injectable } from 'inversify';

import db from '@/backend/infrastructure/db';
import { InsertWord, Word, words } from '@/backend/infrastructure/db/tables/words';
import WordsRepository, { GetAllWordsQuery, WordContent } from '@/backend/services/repositories/WordsRepository';

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

    /**
     * 按单词查找记录；LIKE 在 SQLite 中对 ASCII 字母不区分大小写。
     *
     * @param word 单词。
     * @returns 命中的记录；不存在时返回 null。
     */
    public async findByWord(word: string): Promise<Word | null> {
        const rows = await db
            .select()
            .from(words)
            .where(like(words.word, word))
            .limit(1);
        return rows[0] ?? null;
    }

    /**
     * 插入单个单词。
     *
     * @param value 单词与释义。
     */
    public async insertOne(value: WordContent): Promise<void> {
        const now = new Date().toISOString();
        db.insert(words)
            .values({
                word: value.word,
                translate: value.translate,
                created_at: now,
                updated_at: now,
            })
            .run();
    }

    /**
     * 按旧单词定位记录并更新单词与释义。
     *
     * @param oldWord 更新前的单词。
     * @param value 更新后的单词与释义。
     */
    public async updateByWord(oldWord: string, value: WordContent): Promise<void> {
        db.update(words)
            .set({
                word: value.word,
                translate: value.translate,
                updated_at: new Date().toISOString(),
            })
            .where(like(words.word, oldWord))
            .run();
    }

    /**
     * 按单词删除记录。
     *
     * @param word 单词。
     */
    public async deleteByWord(word: string): Promise<void> {
        db.delete(words)
            .where(like(words.word, word))
            .run();
    }
}
