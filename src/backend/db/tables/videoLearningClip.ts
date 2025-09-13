import { sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const videoLearningClip = sqliteTable('dp_video_learning_clip', {
    key: text('key').primaryKey(),
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

export type VideoLearningClip = typeof videoLearningClip.$inferSelect;
export type InsertVideoLearningClip = typeof videoLearningClip.$inferInsert;
