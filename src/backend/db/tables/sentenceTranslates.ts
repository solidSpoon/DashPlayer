import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const sentenceTranslates = sqliteTable('dp_sentence_translates', {
    id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
    sentence: text('sentence').notNull(),
    translate: text('translate'),
    mode: text('mode', { enum: ['tencent', 'openai_zh', 'openai_simple_en'] }).notNull().default('tencent'),
    created_at: text('created_at')
        .notNull()
        .default(sql`CURRENT_TIMESTAMP`),
    updated_at: text('updated_at')
        .notNull()
        .default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
    sentenceModeUnique: uniqueIndex('dp_sentence_translates_sentence_mode_unique').on(table.sentence, table.mode),
}));

export type SentenceTranslate = typeof sentenceTranslates.$inferSelect; // return type when queried
export type InsertSentenceTranslate = typeof sentenceTranslates.$inferInsert; // insert type
