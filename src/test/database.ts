import path from 'path';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';

import { createDb, type Db } from '@/backend/infrastructure/db/createDb';

/**
 * 内存数据库测试句柄，测试结束后需要调用 close 释放连接。
 */
export interface MemoryDb {
    /** 已执行完整迁移的 drizzle 实例。 */
    db: Db;
    /** 关闭底层 SQLite 连接。 */
    close: () => void;
}

/**
 * 创建并迁移一个独立的内存 SQLite 数据库。
 *
 * 每次调用都返回全新连接和全新库，测试用例之间互不污染。
 *
 * @returns 已建表的内存数据库句柄。
 */
export function createMemoryDb(): MemoryDb {
    const { db, close } = createDb(':memory:');
    migrate(db, {
        migrationsFolder: path.resolve(process.cwd(), 'drizzle', 'migrations'),
    });
    return { db, close };
}
