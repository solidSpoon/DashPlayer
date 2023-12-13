import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const kvs = sqliteTable('dp_kvs', {
    id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
    key: text('key').notNull().unique(),
    value: text('value'),
    created_at: text('created_at')
        .notNull()
        .default(sql`CURRENT_TIMESTAMP`),
    updated_at: text('updated_at')
        .notNull()
        .default(sql`CURRENT_TIMESTAMP`),
});

export type Kv = typeof kvs.$inferSelect; // return type when queried
export type InsertKv = typeof kvs.$inferInsert; // insert type
