import { integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

/**
 * 持久化本地转录队列，文件路径是任务去重键。
 */
export const transcriptionTask = sqliteTable('dp_transcription_task', {
    id: integer('id', { mode: 'number' }).primaryKey({ autoIncrement: true }),
    file_path: text('file_path').notNull(),
    status: text('status'),
    result: text('result'),
    created_at: text('created_at')
        .notNull()
        .default(sql`CURRENT_TIMESTAMP`),
    updated_at: text('updated_at')
        .notNull()
        .default(sql`CURRENT_TIMESTAMP`),
}, (table) => ({
    filePathUniqueIdx: uniqueIndex('dp_transcription_task_file_path_unique').on(table.file_path),
}));

/** 转录任务查询行类型。 */
export type TranscriptionTaskRow = typeof transcriptionTask.$inferSelect;

/** 转录任务插入行类型。 */
export type InsertTranscriptionTaskRow = typeof transcriptionTask.$inferInsert;
