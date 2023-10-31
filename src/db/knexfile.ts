import type { Knex } from 'knex';

const { app } = require('electron');

const path = require('path');
// Update with your config settings.

const isDev = process.env.NODE_ENV === 'development';
console.log('isDev', isDev);
console.log('apppath', app?.getAppPath?.());
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
        directory: isDev
            ? 'db/migrations'
            : `${app?.getAppPath?.()}/../db/migrations`,
    },
    seeds: {
        directory: isDev ? 'db/seeds' : `${app?.getAppPath?.()}/../db/seeds`,
    },
    useNullAsDefault: true,
};

export default config;
