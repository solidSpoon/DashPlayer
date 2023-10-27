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
    },
    seeds: {
        directory: './seeds',
    },
    useNullAsDefault: true,

    // staging: {
    //     client: 'postgresql',
    //     connection: {
    //         database: 'my_db',
    //         user: 'username',
    //         password: 'password',
    //     },
    //     pool: {
    //         min: 2,
    //         max: 10,
    //     },
    //     migrations: {
    //         tableName: 'knex_migrations',
    //     },
    // },
    //
    // production: {
    //     client: 'postgresql',
    //     connection: {
    //         database: 'my_db',
    //         user: 'username',
    //         password: 'password',
    //     },
    //     pool: {
    //         min: 2,
    //         max: 10,
    //     },
    //     migrations: {
    //         tableName: 'knex_migrations',
    //     },
    // },
};

module.exports = config;
