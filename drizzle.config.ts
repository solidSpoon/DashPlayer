import type { Config } from 'drizzle-kit';
import fs from 'fs';
import path from 'path';

const workspaceRoot = process.cwd();
const configuredDbPath = process.env.DRIZZLE_DB_PATH;
// Drizzle 默认使用仓库内的独立工具库，禁止再隐式连接用户媒体库或应用运行数据库。
const toolingDbDirectory = path.join(workspaceRoot, '.local', 'drizzle');
const toolingDbPath = path.join(toolingDbDirectory, 'dp_db.sqlite3');
const drizzleDbPath = configuredDbPath ? path.resolve(configuredDbPath) : toolingDbPath;

if (!configuredDbPath) {
    fs.mkdirSync(toolingDbDirectory, { recursive: true });
}

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
