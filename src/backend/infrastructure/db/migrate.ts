import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import fs from 'fs';
import db, { clearDB } from './db';
import { getMainLogger } from '@/backend/ioc/simple-logger';

const isDev = process.env.NODE_ENV === 'development';
const config = {
    migrationsFolder: isDev
        ? 'drizzle/migrations'
        : `${process.resourcesPath}/drizzle/migrations`,
};
const runMigrate = async () => {
    // migrate(db, config);
    try {
        migrate(db, config);
    } catch (error) {
        const logger = getMainLogger('db-migrate');
        logger.error('run migrate failed, clear db and retry', error);
        await clearDB();
        migrate(db, config);
    }
}

const logger = getMainLogger('db-migrate');
logger.debug('runMigrate config', config);
logger.debug('runMigrate resourcesPath', process.resourcesPath);
fs.readdirSync(config.migrationsFolder).forEach((file) => {
    logger.debug('migration file', file);
});
export default runMigrate;
