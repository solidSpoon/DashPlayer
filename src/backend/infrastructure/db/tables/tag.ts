import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const tag = sqliteTable('dp_tag', {
    id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
    name: text('name').notNull().unique(),
    created_at: text('created_at')
        .notNull()
        .default(sql`CURRENT_TIMESTAMP`),
    updated_at: text('updated_at')
        .notNull()
        .default(sql`CURRENT_TIMESTAMP`),
});

export type TagRow = typeof tag.$inferSelect;
/** 兼容数据库层测试和旧 infrastructure 内部调用的行类型别名。 */
export type Tag = TagRow;
export type InsertTag = typeof tag.$inferInsert; // insert type
