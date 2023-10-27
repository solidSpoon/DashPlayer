import { Knex } from 'knex';
import {
    createAtTimestampTrigger,
    updateAtTimestampTrigger,
} from '../service/BaseService';
import { SENTENCE_TRANSLATE_TABLE_NAME } from '../entity/SentenceTranslate';

export async function up(knex: Knex): Promise<void> {
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
        });
}

export async function down(knex: Knex): Promise<void> {
    return knex.schema.dropTable(SENTENCE_TRANSLATE_TABLE_NAME);
}
