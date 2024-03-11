import type { Config } from 'drizzle-kit';
import path from 'path';
import { app } from 'electron';

export default {
    schema: './src/backend/db/tables',
    out: './drizzle/migrations',
    driver: 'better-sqlite', // 'pg' | 'mysql2' | 'better-sqlite' | 'libsql' | 'turso'
    dbCredentials: {
        url: path.join(
            app?.getPath?.('userData') ?? __dirname,
            'useradd',
            'dp_db.sqlite3'
        ),
    },
} as Config;
