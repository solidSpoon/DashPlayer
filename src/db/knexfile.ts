import type { Knex } from 'knex';

const { app } = require('electron');

const path = require('path');
// Update with your config settings.

const config: Knex.Config = {
    client: 'sqlite3',
    connection: {
        filename: path.join(
            app?.getPath?.('userData') ?? __dirname,
            'useradd',
            'dp_db.sqlite3'
        ),
    },
    migrations: {
        tableName: 'dp_knex_migrations',
        directory: 'resources/db/migrations',
    },
    seeds: {
        directory: 'resources/db/seeds',
    },
    useNullAsDefault: true,
};

export default config;
