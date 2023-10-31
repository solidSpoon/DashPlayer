import {
    createAtTimestampTrigger,
    updateAtTimestampTrigger,
} from './util/util.js';

export async function up(knex) {
    return knex.schema
        .createTable('dp_word_level', (table) => {
            table.increments('id').primary();
            table.string('word').notNullable();
            table.integer('level').notNullable().defaultTo(2);
            table.integer('translate').nullable();
            // create_at and update_at
            table.timestamps(true, false);
            table.unique(['word']);
        })
        .then(() => {
            return knex.raw(createAtTimestampTrigger('dp_word_level'));
        })
        .then(() => {
            return knex.raw(updateAtTimestampTrigger('dp_word_level'));
        });
}

export async function down(knex) {
    return knex.schema.dropTable('dp_word_level');
}
