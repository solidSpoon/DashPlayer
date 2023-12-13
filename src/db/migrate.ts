import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { app } from 'electron';
import fs from 'fs';
import db from './db';

const isDev = process.env.NODE_ENV === 'development';
const config = {
    migrationsFolder: isDev
        ? 'drizzle/migrations'
        : `${process.resourcesPath}/drizzle/migrations`,
};
const runMigrate = async () => {
    migrate(db, config);
};

console.log('runMigrate', config);
console.log('runMigrate', process.resourcesPath);
fs.readdirSync(config.migrationsFolder).forEach((file) => {
    console.log('file', file);
});
export default runMigrate;
