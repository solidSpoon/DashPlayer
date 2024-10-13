import { index, integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const watchHistory = sqliteTable('dp_watch_history', {
    id: text('id').primaryKey(),
    base_path: text('project_name').notNull(),
    file_name: text('project_path').notNull(),
    project_type: integer('project_type', { mode: 'number' }).notNull(),
    current_position: integer('last_watch_time').notNull().default(0),
    srt_file: text('srt_file'),
    created_at: text('created_at')
        .notNull()
        .default(sql`CURRENT_TIMESTAMP`),
    updated_at: text('updated_at')
        .notNull()
        .default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
    basePathFileNameIdx: index('base_path_file_name_idx').on(table.base_path, table.file_name),
}));

export type WatchHistory = typeof watchHistory.$inferSelect; // return type when queried
export type InsertWatchHistory = typeof watchHistory.$inferInsert; // insert type
export enum WatchHistoryType {
    FILE = 1,
    DIRECTORY = 2,
}
