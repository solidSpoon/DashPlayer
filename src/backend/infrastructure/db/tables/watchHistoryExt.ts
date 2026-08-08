import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

/**
 * 观看记录扩展表：存放每个视频的播放器模式用户偏好。
 *
 * 主表 dp_watch_history 只记录播放进度等基础信息；这里单独存放
 * 「用户是否手动设置过播客模式」及手动设置的值，供播放页自动切换逻辑读取。
 */
export const watchHistoryExt = sqliteTable('dp_watch_history_ext', {
    id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
    watch_history_id: text('watch_history_id').notNull().unique(),
    /**
     * 用户是否手动设置过播客模式（0/1）。
     */
    podcast_mode_user_set: integer('podcast_mode_user_set', { mode: 'boolean' }).notNull().default(false),
    /**
     * 用户手动选择的播客模式值（0=普通模式，1=播客模式）。
     */
    podcast_mode_manual: integer('podcast_mode_manual', { mode: 'boolean' }).notNull().default(false),
    created_at: text('created_at')
        .notNull()
        .default(sql`CURRENT_TIMESTAMP`),
    updated_at: text('updated_at')
        .notNull()
        .default(sql`CURRENT_TIMESTAMP`),
});

export type WatchHistoryExt = typeof watchHistoryExt.$inferSelect; // return type when queried
export type InsertWatchHistoryExt = typeof watchHistoryExt.$inferInsert; // insert type
