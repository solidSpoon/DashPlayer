import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const sentenceTranslates = sqliteTable('dp_sentence_translates', {
    id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
    sentence: text('sentence').notNull().unique(),
    translate: text('translate'),
    created_at: text('created_at')
        .notNull()
        .default(sql`datetime('now', 'localtime')`),
    updated_at: text('updated_at')
        .notNull()
        .default(sql`datetime('now', 'localtime')`),
});

export type SentenceTranslate = typeof sentenceTranslates.$inferSelect; // return type when queried
export type InsertSentenceTranslate = typeof sentenceTranslates.$inferInsert; // insert type
