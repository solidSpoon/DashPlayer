import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const subtitleTimestampAdjustments = sqliteTable(
    'dp_subtitle_timestamp_adjustment',
    {
        id: integer('id', { mode: 'number' }).primaryKey({
            autoIncrement: true,
        }),
        key: text('key').notNull().unique(),
        subtitle_path: text('subtitle_name'),
        start_at: integer('start_at'),
        end_at: integer('end_at'),
        created_at: text('created_at')
            .notNull()
            .default(sql`CURRENT_TIMESTAMP`),
        updated_at: text('updated_at')
            .notNull()
            .default(sql`CURRENT_TIMESTAMP`),
    }
);

export type SubtitleTimestampAdjustment =
    typeof subtitleTimestampAdjustments.$inferSelect; // return type when queried
export type InsertSubtitleTimestampAdjustment =
    typeof subtitleTimestampAdjustments.$inferInsert; // insert type
