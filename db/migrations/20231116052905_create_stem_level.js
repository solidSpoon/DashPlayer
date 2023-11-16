import {
    createAtTimestampTrigger,
    toTrimLowerCaseTrigger,
    updateAtTimestampTrigger,
} from './util/util.js';

export async function up(knex) {
    return knex.schema
        .createTable('dp_stem_level', (table) => {
            table.increments('id').primary();
            table.string('stem').notNullable();
            table.boolean('familiar').notNullable().defaultTo(false);
            // create_at and update_at
            table.timestamps(true, false);
            table.unique(['stem']);
        })
        .then(() => {
            return knex.raw(createAtTimestampTrigger('dp_stem_level'));
        })
        .then(() => {
            return knex.raw(updateAtTimestampTrigger('dp_stem_level'));
        })
        .then(() => {
            return knex.raw(toTrimLowerCaseTrigger('dp_stem_level', 'stem'));
        });
}

export async function down(knex) {
    return knex.schema.dropTable('dp_word_level');
}
