import type { Config } from 'drizzle-kit';
import path from 'path';

const DEV_LIB_PATH = '/Users/solidspoon/Desktop/DashPlayer';

export default {
    dialect: 'sqlite',
    schema: './src/backend/db/tables',
    out: './drizzle/migrations',
    dbCredentials: {
        url: path.join(
            DEV_LIB_PATH, 'data', 'dp_db.sqlite3'
        ),
    },
} as Config;
