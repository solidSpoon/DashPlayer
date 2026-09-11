import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

/**
 * 持久化播放修复记录，媒体文件路径是唯一去重键。
 *
 * 这张表只是「哪个视频修过、结果如何」的记录，**不是**判断产物能不能播的依据：
 * 产物是否存在、能不能播一律看磁盘上的文件，表里的状态允许因为用户在系统里
 * 删除或改名而变旧。修复任务只存活在当前进程内，所以进程重启时会把
 * `in_progress` 的行标记成已中断。
 */
export const repairTask = sqliteTable('dp_repair_task', {
    id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
    file_path: text('file_path').notNull(),
    /** 修复状态，取值见 RepairTaskState。 */
    status: text('status'),
    /** 本次采用的修复配方，用于展示与排查。 */
    recipe: text('recipe'),
    /** 修复产物路径。 */
    output_path: text('output_path'),
    /** 诊断原因，用于区分「本来就无需修复」与「已修复」。 */
    reason: text('reason'),
    /** 正在运行的后台任务编号；前端据此订阅实时进度。 */
    task_id: integer('task_id', { mode: 'number' }),
    /** 失败原因。 */
    error: text('error'),
    created_at: text('created_at')
        .notNull()
        .default(sql`CURRENT_TIMESTAMP`),
    updated_at: text('updated_at')
        .notNull()
        .default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
    filePathUniqueIdx: uniqueIndex('dp_repair_task_file_path_unique').on(table.file_path),
}));

/** 修复记录查询行类型。 */
export type RepairTaskRow = typeof repairTask.$inferSelect;

/** 修复记录插入行类型。 */
export type InsertRepairTaskRow = typeof repairTask.$inferInsert;
