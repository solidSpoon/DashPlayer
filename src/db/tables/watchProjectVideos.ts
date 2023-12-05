import { integer, sqliteTable, text, unique } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const watchProjectVideos = sqliteTable('dp_watch_project_videos', {
    id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
    project_id: integer('project_id', { mode: 'number' }).notNull(),
    video_name: text('video_name').notNull(),
    video_path: text('video_path', { length: 1024 }).notNull(),
    current_playing: integer('current_playing', { mode: 'boolean' })
        .notNull()
        .default(false),
    subtitle_path: text('subtitle_path', { length: 1024 }),
    current_time: integer('current_time', { mode: 'number' })
        .notNull()
        .default(0),
    duration: integer('duration', { mode: 'number' }).notNull().default(0),
    created_at: text('created_at')
        .notNull()
        .default(sql`CURRENT_TIMESTAMP`),
    updated_at: text('updated_at')
        .notNull()
        .default(sql`CURRENT_TIMESTAMP`),
},(t) => ({
    unq: unique().on(t.project_id, t.video_path),
}));

export type WatchProjectVideo = typeof watchProjectVideos.$inferSelect; // return type when queried
export type InsertWatchProjectVideo = typeof watchProjectVideos.$inferInsert; // insert type
