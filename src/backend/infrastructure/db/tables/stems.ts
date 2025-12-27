import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const stems = sqliteTable('dp_stems', {
    id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
    stem: text('stem').notNull().unique(),
    familiar: integer('familiar', { mode: 'boolean' }).notNull().default(false),
    created_at: text('created_at')
        .notNull()
        .default(sql`CURRENT_TIMESTAMP`),
    updated_at: text('updated_at')
        .notNull()
        .default(sql`CURRENT_TIMESTAMP`),
});

export type Stem = typeof stems.$inferSelect; // return type when queried
export type InsertStem = typeof stems.$inferInsert; // insert type
