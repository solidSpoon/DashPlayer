import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

/**
 * 修复名单的「组标记」表。
 *
 * 组只是给用户看的标记：一次「添加文件 / 添加文件夹」动作产生一组，便于整批修复、整批
 * 删除。文件的身份是路径，状态存在 dp_repair_task 里，所以同一个文件可以同时挂在多个
 * 组里，在任意一个组里修它，其它组都会跟着显示最新状态。
 */
export const repairGroupFile = sqliteTable('dp_repair_group_file', {
    id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
    /** 组标识：文件夹来源为 `folder:<目录绝对路径>`，手动多选为 `files:<时间戳>`。 */
    group_key: text('group_key').notNull(),
    /** 组的来源类型：folder / files。界面据此决定标题写法。 */
    group_source: text('group_source').notNull(),
    /** 文件夹来源时记录目录绝对路径；手动多选为空。 */
    group_path: text('group_path'),
    /** 组内媒体绝对路径。 */
    file_path: text('file_path').notNull(),
    created_at: text('created_at')
        .notNull()
        .default(sql`CURRENT_TIMESTAMP`),
    updated_at: text('updated_at')
        .notNull()
        .default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
    groupFileUniqueIdx: uniqueIndex('dp_repair_group_file_unique').on(table.group_key, table.file_path),
}));

/** 组标记查询行类型。 */
export type RepairGroupFileRow = typeof repairGroupFile.$inferSelect;

/** 组标记插入行类型。 */
export type InsertRepairGroupFileRow = typeof repairGroupFile.$inferInsert;
