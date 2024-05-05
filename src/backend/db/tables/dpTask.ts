import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

export enum DpTaskState {
    INIT = 'init',
    IN_PROGRESS = 'in_progress',
    DONE = 'done',
    CANCELLED = 'cancelled',
    FAILED = 'failed',
}

export const dpTask = sqliteTable('dp_task', {
    id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
    status: text('status').notNull().default(DpTaskState.INIT),
    progress: text('description').default('任务创建成功'),
    result: text('result'),
    created_at: text('created_at')
        .notNull()
        .default(sql`CURRENT_TIMESTAMP`),
    updated_at: text('updated_at')
        .notNull()
        .default(sql`CURRENT_TIMESTAMP`),
});

export type DpTask = typeof dpTask.$inferSelect; // return type when queried
export type InsertDpTask = typeof dpTask.$inferInsert; // insert type
