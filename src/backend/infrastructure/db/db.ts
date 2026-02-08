import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import path from 'path';
import { and, ExtractTablesWithRelations, sql } from 'drizzle-orm';
import fs from 'fs';
import { SQLiteTransaction } from 'drizzle-orm/sqlite-core';
import { LocationType } from '@/backend/application/services/LocationService';
import LocationUtil from '@/backend/utils/LocationUtil';
import { isDevelopmentMode } from '@/backend/utils/runtimeEnv';

// const file = path.join(
//     app?.getPath?.('userData') ?? __dirname,
//     'useradd',
//     'dp_db.sqlite3'
// );
const file = path.join(LocationUtil.staticGetStoragePath(LocationType.DATA), 'dp_db.sqlite3');
const enableDbLog = process.env.DP_DB_LOG === 'true';
const dir = path.dirname(file);

if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
}
const sqlite = new Database(file);
const db = drizzle(sqlite, { logger: isDevelopmentMode() && enableDbLog });

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
