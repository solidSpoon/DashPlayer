import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const videoClip = sqliteTable('dp_video_clip', {
    id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
    key: text('key').notNull().unique(),
    video_name: text('video_name'),
    /**
     * 收藏的行
     */
    srt_clip: text('srt_clip'),
    /**
     * 周围的字幕
     */
    srt_context: text('srt_context'),
    created_at: text('created_at')
        .notNull()
        .default(sql`CURRENT_TIMESTAMP`),
    updated_at: text('updated_at')
        .notNull()
        .default(sql`CURRENT_TIMESTAMP`),
});

export type VideoClip = typeof videoClip.$inferSelect; // return type when queried
export type InsertVideoClip = typeof videoClip.$inferInsert; // insert type
