import { drizzle, type BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import fs from 'fs';
import path from 'path';

/**
 * drizzle 与 better-sqlite3 组合出的同步数据库类型。
 *
 * 仓储层统一注入该类型，测试中可替换为内存库实例。
 */
export type Db = BetterSQLite3Database<Record<string, never>>;

/**
 * 创建数据库时的可选配置。
 */
export interface CreateDbOptions {
    /** 是否开启 drizzle 的 SQL 语句日志；默认关闭。 */
    logger?: boolean;
    /** 慢查询回调，用于统一慢环节归因；不传则跳过慢查询告警。 */
    onSlowQuery?: (sql: string, ms: number) => void;
}

/**
 * 创建完成后的数据库句柄。
 */
export interface DbHandle {
    /** drizzle ORM 实例，仓储层统一通过它执行查询。 */
    db: Db;
    /** 底层 better-sqlite3 连接，供清库等需要 exec 的场景使用。 */
    sqlite: InstanceType<typeof Database>;
    /** 关闭底层数据库连接。 */
    close: () => void;
}

/** 慢查询阈值：超过该毫秒数触发慢查询回调。 */
const SLOW_QUERY_THRESHOLD_MS = 500;

/**
 * 给 better-sqlite3 实例打统一慢查询计时补丁。
 *
 * 行为说明：
 * - 拦截 prepare 返回语句的 all/get/run 执行方法，drizzle 的所有查询
 *   （含事务 savepoint）都会经过此处，仓储层无需逐个包装；
 * - 超过阈值时触发 onSlowQuery（含归一化后的 SQL 文本与耗时），异常照常向上抛、不吞错；
 * - 只影响当前实例，不污染其它 Database 实例。
 *
 * @param sqlite 已创建的 better-sqlite3 实例。
 * @param onSlowQuery 慢查询回调，缺省时不做任何上报。
 */
function wrapTimingDatabase(
    sqlite: InstanceType<typeof Database>,
    onSlowQuery?: (sql: string, ms: number) => void,
): void {
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
                    onSlowQuery?.(sqlText, costMs);
                }
            }
        };
        stmt.all = wrap(stmt.all.bind(stmt));
        stmt.get = wrap(stmt.get.bind(stmt));
        stmt.run = wrap(stmt.run.bind(stmt));
        return stmt;
    }) as typeof sqlite.prepare;
}

/**
 * 根据给定路径创建 SQLite 数据库并返回完整句柄。
 *
 * 行为说明：
 * - 路径为 ':memory:' 时创建内存库，不创建目录；
 * - 其它路径会先确保父目录存在；
 * - 该模块不依赖 Electron，测试和生产启动均可直接调用。
 *
 * @param dbPath SQLite 文件路径或 ':memory:'。
 * @param options 日志与慢查询回调配置。
 * @returns 包含 drizzle 实例、底层连接和关闭函数的句柄。
 */
export function createDb(dbPath: string, options: CreateDbOptions = {}): DbHandle {
    if (dbPath !== ':memory:') {
        const dir = path.dirname(dbPath);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }

    const sqlite = new Database(dbPath);
    wrapTimingDatabase(sqlite, options.onSlowQuery);
    const db = drizzle(sqlite, { logger: options.logger ?? false });

    return {
        db,
        sqlite,
        close: () => sqlite.close(),
    };
}
