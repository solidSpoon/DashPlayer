import {
    createAtTimestampTrigger,
    toTrimLowerCaseTrigger,
    updateAtTimestampTrigger,
    WORD_TRANSLATE_TABLE_NAME,
} from './util/util.js';

export async function up(knex) {
    return knex.schema
        .createTable(WORD_TRANSLATE_TABLE_NAME, (table) => {
            table.increments('id').primary();
            table.string('word').notNullable();
            table.text('translate').nullable();
            // create_at and update_at
            table.timestamps(true, false);
            table.unique(['word']);
        })
        .then(() => {
            return knex.raw(
                createAtTimestampTrigger(WORD_TRANSLATE_TABLE_NAME)
            );
        })
        .then(() => {
            return knex.raw(
                updateAtTimestampTrigger(WORD_TRANSLATE_TABLE_NAME)
            );
        })
        .then(() => {
            return knex.raw(
                toTrimLowerCaseTrigger(WORD_TRANSLATE_TABLE_NAME, 'word')
            );
        });
}

export async function down(knex) {
    return knex.schema.dropTable(WORD_TRANSLATE_TABLE_NAME);
}
