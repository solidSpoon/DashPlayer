import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import path from 'path';
import { and, ExtractTablesWithRelations, sql } from 'drizzle-orm';
import fs from 'fs';
import { SQLiteTransaction } from 'drizzle-orm/sqlite-core';
import { isDevelopmentMode } from '@/backend/utils/runtimeEnv';
import { AppStateDirectoryType, getAppStatePath } from '@/backend/infrastructure/system/AppStatePath';
import { getMainLogger } from '@/backend/infrastructure/logger';

// const file = path.join(
//     app?.getPath?.('userData') ?? __dirname,
//     'useradd',
//     'dp_db.sqlite3'
// );
const file = path.join(getAppStatePath(AppStateDirectoryType.DATA), 'dp_db.sqlite3');
const enableDbLog = process.env.DP_DB_LOG === 'true';
const dir = path.dirname(file);

if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
}
const sqlite = new Database(file);
// 统一慢查询归因：在 prepare 唯一入口给所有语句计时，仓储层无需逐个包装。
wrapTimingDatabase(sqlite);
const db = drizzle(sqlite, { logger: isDevelopmentMode() && enableDbLog });

/** 慢查询阈值：超过该毫秒数记 warn，用于慢环节归因。 */
const SLOW_QUERY_THRESHOLD_MS = 500;

/**
 * 给 better-sqlite3 实例打统一慢查询计时补丁。
 *
 * 行为说明：
 * - 拦截 prepare 返回语句的 all/get/run 执行方法，drizzle 的所有查询
 *   （含事务 savepoint）都会经过此处，仓储层无需逐个包装；
 * - 超过阈值记 warn（含归一化后的 SQL 文本与耗时），异常照常向上抛、不吞错；
 * - 只影响当前实例，不污染其它 Database 实例。
 *
 * @param sqlite 已创建的 better-sqlite3 实例。
 */
function wrapTimingDatabase(sqlite: InstanceType<typeof Database>): void {
    const originalPrepare = sqlite.prepare.bind(sqlite);
    sqlite.prepare = ((source: string) => {
        const stmt = originalPrepare(source);
        // 归一化 SQL 文本：折叠换行/连续空白并截断，避免超长语句撑爆日志行。
        const sqlText = source.replace(/\s+/g, ' ').trim().slice(0, 300);
        const wrap = <A extends unknown[], R>(exec: (...args: A) => R): ((...args: A) => R) => (...args: A): R => {
            const start = Date.now();
            try {
                return exec(...args);
            } finally {
                const costMs = Date.now() - start;
                if (costMs > SLOW_QUERY_THRESHOLD_MS) {
                    getMainLogger('db-slow-query').warn('slow query', { sql: sqlText, ms: costMs });
                }
            }
        };
        stmt.all = wrap(stmt.all.bind(stmt));
        stmt.get = wrap(stmt.get.bind(stmt));
        stmt.run = wrap(stmt.run.bind(stmt));
        return stmt;
    }) as typeof sqlite.prepare;
}

// 清空数据库
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
