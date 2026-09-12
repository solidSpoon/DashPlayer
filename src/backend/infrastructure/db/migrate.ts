import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import fs from 'fs';
import db from './db';
import { getMainLogger } from '@/backend/infrastructure/logger';
import { getRuntimeResourcePath } from '@/backend/utils/runtimeEnv';

const config = {
    migrationsFolder: getRuntimeResourcePath('drizzle', 'migrations'),
};
/**
 * 执行数据库 schema 迁移。
 *
 * 失败时如实上抛：调用方（runStartupMigrations → main）会把失败写进恢复状态并进入恢复模式，
 * 由迁移失败页告诉用户失败在哪一步、可以重试，或者由用户自己确认后「重置并重试」。
 *
 * 这里**不允许**顺手清库重试：空库上重跑迁移通常能成功，于是失败被悄悄吞掉——用户拿到一个
 * 被清空的数据库（观看历史、词库、任务全丢），却连失败提示都看不到。清库只能由用户在失败页上
 * 主动确认后触发（SystemController.resetDb）。
 *
 * @throws 迁移失败时抛出原始错误，交由上层进入恢复模式。
 */
const runMigrate = async (): Promise<void> => {
    try {
        migrate(db, config);
    } catch (error) {
        getMainLogger('db-migrate').error('run migrate failed', { error });
        throw error;
    }
}

const logger = getMainLogger('db-migrate');
logger.debug('runMigrate config', { config });
logger.debug('runMigrate resourcesPath', { resourcesPath: process.resourcesPath });
fs.readdirSync(config.migrationsFolder).forEach((file) => {
    logger.debug('migration file', { file });
});
export default runMigrate;
