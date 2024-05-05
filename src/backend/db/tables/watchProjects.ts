import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export const watchProjects = sqliteTable('dp_watch_projects', {
    id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
    project_name: text('project_name').notNull(),
    project_type: integer('type', { mode: 'number' }).notNull().default(0),
    project_path: text('project_path', { length: 1024 }).notNull().unique(),
    current_playing: integer('current_playing', { mode: 'boolean' })
        .notNull()
        .default(false),
    last_watch_time: text('last_watch_time')
        .notNull()
        .default(sql`CURRENT_TIMESTAMP`),
    created_at: text('created_at')
        .notNull()
        .default(sql`CURRENT_TIMESTAMP`),
    updated_at: text('updated_at')
        .notNull()
        .default(sql`CURRENT_TIMESTAMP`),
});

export type WatchProject = typeof watchProjects.$inferSelect; // return type when queried
export type InsertWatchProject = typeof watchProjects.$inferInsert; // insert type
export enum WatchProjectType {
    FILE = 1,
    DIRECTORY = 2,
}
