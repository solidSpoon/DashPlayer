import { drizzle } from 'drizzle-orm/better-sqlite3';
import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';
import { and, sql } from 'drizzle-orm';

const file = path.join(
    app?.getPath?.('userData') ?? __dirname,
    'useradd',
    'dp_db.sqlite3'
);
const isDev = process.env.NODE_ENV === 'development';
const sqlite = new Database(file);
const db = drizzle(sqlite, { logger: isDev });

// 清空数据库
export async function clearDB() {
    // Get all tables
    let tables = await db.select({
        name: sql<string>`name`,
    })
        .from(sql`sqlite_master`)
        .where(and(sql`type = 'table'`, sql`name != 'sqlite_sequence'`));

    // Drop all tables
    for (const table of tables.map(e => e.name)) {
        sqlite.exec(`DROP TABLE ${table}`);
    }

    // Get all indexes
    let indexes = await db.select({
        name: sql<string>`name`,
    })
        .from(sql`sqlite_master`)
        .where(sql`type = 'index'`);

    // Drop all indexes
    for (const index of indexes.map(e => e.name)) {
        sqlite.exec(`DROP INDEX ${index}`);
    }

    // Clear all sequences
    sqlite.exec(`DELETE FROM sqlite_sequence WHERE 1=1`);
}

export default db;
