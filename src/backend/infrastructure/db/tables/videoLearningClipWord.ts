import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const videoLearningClipWord = sqliteTable('dp_video_learning_clip_word', {
    id: integer('id').primaryKey({ autoIncrement: true }),
    /**
     * 视频学习片段键
     */
    clip_key: text('clip_key').notNull(),
    /**
     * 匹配的单词
     */
    word: text('word').notNull(),
    /**
     * 创建时间
     */
    created_at: text('created_at')
        .notNull()
        .default(sql`CURRENT_TIMESTAMP`),
    /**
     * 更新时间
     */
    updated_at: text('updated_at')
        .notNull()
        .default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
    // 创建复合唯一索引，确保同一个片段不会重复添加同一个单词
    // 使用 word-key 顺序优化单词查询性能
    wordClipKeyUniqueIdx: uniqueIndex('idx_dp_video_learning_clip_word_word_clip_key_unique').on(table.word, table.clip_key)
}));

export type VideoLearningClipWord = typeof videoLearningClipWord.$inferSelect;
export type InsertVideoLearningClipWord = typeof videoLearningClipWord.$inferInsert;