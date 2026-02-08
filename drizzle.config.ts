import type { Config } from 'drizzle-kit';
import os from 'os';
import path from 'path';

const workspaceRoot = process.cwd();
const configuredDbPath = process.env.DRIZZLE_DB_PATH;
const configuredStorageBase = process.env.DP_STORAGE_PATH;

const defaultStorageBase = configuredStorageBase
    ? path.resolve(configuredStorageBase)
    : path.join(os.homedir(), 'Documents', 'DashPlayer-dev');

const defaultDbPath = path.join(defaultStorageBase, 'data', 'dp_db.sqlite3');
const drizzleDbPath = configuredDbPath ? path.resolve(configuredDbPath) : defaultDbPath;

export default {
    dialect: 'sqlite',
    schema: './src/backend/infrastructure/db/tables/*.ts',
    out: './drizzle/migrations',
    dbCredentials: {
        url: drizzleDbPath,
    },
    verbose: true,
    strict: true,
    cwd: workspaceRoot,
} as Config;
