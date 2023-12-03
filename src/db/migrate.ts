import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { app } from 'electron';
import db from './db';

const isDev = process.env.NODE_ENV === 'development';
const runMigrate = async () => {
    migrate(db, {
        migrationsFolder: isDev
            ? 'drizzle/migrations'
            : `${app?.getAppPath?.()}/../drizzle/migrations`,
    });
};

export default runMigrate;
