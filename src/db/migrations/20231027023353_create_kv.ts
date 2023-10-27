import { Knex } from 'knex';
import { createAtTimestampTrigger, updateAtTimestampTrigger } from '../service/BaseService';

export async function up(knex: Knex): Promise<void> {
    return knex.schema
        .createTable('dp_kv', (table) => {
            table.increments('id').primary();
            table.string('key').notNullable();
            table.text('value').nullable();
            // create_at and update_at
            table.timestamps(true, false);
            table.unique(['key']);
        })
        .then(() => {
            return knex.raw(createAtTimestampTrigger('dp_kv'));
        })
        .then(() => {
            return knex.raw(updateAtTimestampTrigger('dp_kv'));
        });
}

export async function down(knex: Knex): Promise<void> {
    return knex.schema.dropTable('dp_kv');
}
