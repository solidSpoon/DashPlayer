import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const wordTranslates = sqliteTable('dp_word_translates', {
    id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
    word: text('word').notNull().unique(),
    translate: text('translate'),
    created_at: text('created_at')
        .notNull()
        .default(sql`CURRENT_TIMESTAMP`),
    updated_at: text('updated_at')
        .notNull()
        .default(sql`CURRENT_TIMESTAMP`),
});

export type WordTranslate = typeof wordTranslates.$inferSelect; // return type when queried
export type InsertWordTranslate = typeof wordTranslates.$inferInsert; // insert type
