import {
    createAtTimestampTrigger,
    toTrimLowerCaseTrigger,
    updateAtTimestampTrigger,
} from './util/util.js';

export async function up(knex) {
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
        })
        .then(() => {
            return knex.raw(toTrimLowerCaseTrigger('dp_kv', 'key'));
        });
}

export async function down(knex) {
    return knex.schema.dropTable('dp_kv');
}
