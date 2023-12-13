import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const words = sqliteTable('dp_words', {
    id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
    word: text('word').notNull().unique(),
    stem: text('stem'),
    translate: text('translate'),
    note: text('note'),
    created_at: text('created_at')
        .notNull()
        .default(sql`CURRENT_TIMESTAMP`),
    updated_at: text('updated_at')
        .notNull()
        .default(sql`CURRENT_TIMESTAMP`),
});

export type Word = typeof words.$inferSelect; // return type when queried
export type InsertWord = typeof words.$inferInsert; // insert type
