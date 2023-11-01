import {
    createAtTimestampTrigger,
    SENTENCE_TRANSLATE_TABLE_NAME,
    toTrimLowerCaseTrigger,
    updateAtTimestampTrigger,
} from './util/util.js';

export async function up(knex) {
    return knex.schema
        .createTable(SENTENCE_TRANSLATE_TABLE_NAME, (table) => {
            table.increments('id').primary();
            table.string('sentence').notNullable();
            table.text('translate').nullable();
            // create_at and update_at
            table.timestamps(true, false);
            table.unique(['sentence']);
        })
        .then(() => {
            return knex.raw(
                createAtTimestampTrigger(SENTENCE_TRANSLATE_TABLE_NAME)
            );
        })
        .then(() => {
            return knex.raw(
                updateAtTimestampTrigger(SENTENCE_TRANSLATE_TABLE_NAME)
            );
        })
        .then(() => {
            return knex.raw(
                toTrimLowerCaseTrigger(
                    SENTENCE_TRANSLATE_TABLE_NAME,
                    'sentence'
                )
            );
        });
}

export async function down(knex) {
    return knex.schema.dropTable(SENTENCE_TRANSLATE_TABLE_NAME);
}
