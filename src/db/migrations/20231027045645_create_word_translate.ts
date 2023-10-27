import { Knex } from 'knex';
import { WORD_TRANSLATE_TABLE_NAME } from '../entity/WordTranslate';
import { createAtTimestampTrigger, updateAtTimestampTrigger } from '../service/BaseService';

export async function up(knex: Knex): Promise<void> {
    return knex.schema
        .createTable(WORD_TRANSLATE_TABLE_NAME, (table) => {
            table.increments('id').primary();
            table.string('word').notNullable();
            table.text('translate').nullable();
            // create_at and update_at
            table.timestamps(true, false);
            table.unique(['word']);
            table.index(['word']);
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
        });
}

export async function down(knex: Knex): Promise<void> {
    return knex.schema.dropTable(WORD_TRANSLATE_TABLE_NAME);
}
