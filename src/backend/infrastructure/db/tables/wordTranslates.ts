import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const wordTranslates = sqliteTable('dp_word_translates', {
    id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
    word: text('word').notNull(),
    provider: text('provider').notNull().default('openai'), // 当前仅 'openai'（历史行可能残留 'youdao'，已由启动迁移清理）
    translate: text('translate'),
    created_at: text('created_at')
        .notNull()
        .default(sql`CURRENT_TIMESTAMP`),
    updated_at: text('updated_at')
        .notNull()
        .default(sql`CURRENT_TIMESTAMP`),
}, (table) => {
    return {
        wordProviderIdx: uniqueIndex('word_provider_idx').on(table.word, table.provider),
    };
});

export type WordTranslate = typeof wordTranslates.$inferSelect; // return type when queried
export type InsertWordTranslate = typeof wordTranslates.$inferInsert; // insert type
