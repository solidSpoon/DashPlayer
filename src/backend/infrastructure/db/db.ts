import path from 'path';
import fs from 'fs';
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
const { db, sqlite, close: closeSqlite } = createDb(file, {
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

/**
 * 关闭数据库连接并删除数据库文件（含 -wal / -shm）。
 *
 * 仅供迁移失败后的「重置并重试」使用：必须先关连接（Windows 上打开中的文件
 * 无法删除），再删文件；下次启动由 runMigrate 重建全新库。
 * 有损操作——库内业务数据（生词本、收藏、翻译缓存等）全部丢失。
 *
 * @throws 文件被占用、无写权限等删除失败时原样抛出，由调用方展示给用户。
 */
export async function resetDatabaseFile(): Promise<void> {
    closeSqlite();
    for (const suffix of ['', '-wal', '-shm']) {
        fs.rmSync(`${file}${suffix}`, { force: true });
    }
}

export type Transaction = SQLiteTransaction<'sync', Database.RunResult, Record<string, never>, ExtractTablesWithRelations<Record<string, never>>>;
