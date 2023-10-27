import Knex from 'knex';
import path from 'path';

const knexConfig = require('./knexfile');

const knex = Knex(knexConfig.production);

console.log('__dirname', __dirname);
const migrationConfig = {
    directory: path.join(__dirname, '../db/migrations'),
};

const seedConfig = {
    directory: path.join(__dirname, '../db/seeds'),
};

console.info(`Running migrations in: ${migrationConfig.directory}`);

const migration = async () => {
    const [batchNo, log] = await knex.migrate.latest(migrationConfig);
    if (!log.length) {
        console.info('Database is already up to date');
    } else {
        console.info(`Ran migrations: ${log.join(', ')}`);
    }

    await knex.seed.run(seedConfig);
    await knex.destroy();
};

export default migration;
export { knex as knexDb };
