import Knex from 'knex';
import path from 'path';

import knexConfig from './knexfile';

const knex = Knex(knexConfig);

const migration = async () => {
    const [batchNo, log] = await knex.migrate.latest();
    if (!log.length) {
        console.info('Database is already up to date');
    } else {
        console.info(`Ran migrations: ${log.join(', ')}`);
    }

    await knex.seed.run();
    await knex.destroy();
};

export default migration;
