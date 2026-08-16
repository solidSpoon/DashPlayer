import path from 'path';
import { and, ExtractTablesWithRelations, sql } from 'drizzle-orm';
import { SQLiteTransaction } from 'drizzle-orm/sqlite-core';
import Database from 'better-sqlite3';
import { isDevelopmentMode } from '@/backend/utils/runtimeEnv';
import { AppStateDirectoryType, getAppStatePath } from '@/backend/infrastructure/system/AppStatePath';
import { getMainLogger } from '@/backend/infrastructure/logger';
import { createDb } from './createDb';

// 当前环境的数据库文件路径，由 Electron userData 和开发/生产环境共同决定。
const file = path.join(getAppStatePath(AppStateDirectoryType.DATA), 'dp_db.sqlite3');
const enableDbLog = process.env.DP_DB_LOG === 'true';
const dbLogger = getMainLogger('database');
const slowQueryLogger = getMainLogger('db-slow-query');

// 创建当前运行环境的单例数据库；慢查询通过回调归因到日志。
const { db, sqlite } = createDb(file, {
    logger: isDevelopmentMode() && enableDbLog,
    onSlowQuery: (sqlText, ms) => slowQueryLogger.warn('slow query', { sql: sqlText, ms }),
});
dbLogger.info('database opened', {
    mode: isDevelopmentMode() ? 'development' : 'production',
    path: file,
});

/**
 * 清空当前运行环境数据库中的所有表、索引和自增序列。
 *
 * 仅用于迁移失败后的重试或显式重置；会删除全部业务数据，调用前须明确意图。
 */
export async function clearDB() {
    // Get all tables
    const tables = await db
        .select({
            name: sql<string>`name`,
        })
        .from(sql`sqlite_master`)
        .where(and(sql`type = 'table'`, sql`name != 'sqlite_sequence'`));

    // Drop all tables
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    for (const table of tables.map((e) => e.name)) {
        sqlite.exec(`DROP TABLE ${table}`);
    }

    // Get all indexes
    const indexes = await db
        .select({
            name: sql<string>`name`,
        })
        .from(sql`sqlite_master`)
        .where(sql`type = 'index'`);

    // Drop all indexes
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    for (const index of indexes.map((e) => e.name)) {
        sqlite.exec(`DROP INDEX ${index}`);
    }

    // Clear all sequences
    sqlite.exec(`DELETE FROM sqlite_sequence WHERE 1=1`);
}

export default db;

export type Transaction = SQLiteTransaction<'sync', Database.RunResult, Record<string, never>, ExtractTablesWithRelations<Record<string, never>>>;
